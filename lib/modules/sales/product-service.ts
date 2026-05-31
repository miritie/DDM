/**
 * Service - Gestion des Produits
 * Module Ventes & Encaissements
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Product } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const getDb = () => getPostgresClient();

export interface CreateProductInput {
  name: string;
  description?: string;
  benefits?: string;
  usageNotes?: string;
  composition?: string;
  unitPrice: number;
  currency?: string;
  category?: string;
  unit?: string;
  imageUrl?: string;
  workspaceId: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  benefits?: string | null;
  usageNotes?: string | null;
  composition?: string | null;
  unitPrice?: number;
  category?: string;
  unit?: string;
  imageUrl?: string | null;
  isActive?: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface ProductWithDetails extends Product {
  Benefits?: string | null;
  UsageNotes?: string | null;
  Composition?: string | null;
  AdditionalImages: ProductImage[];
}

/**
 * Service de gestion des produits
 */
export class ProductService {
  async generateProductCode(workspaceId: string): Promise<string> {
    const products = await getDb().list<Product>('products', {
      where: { workspace_id: workspaceId },
    });
    const count = products.length + 1;
    return `PRD-${String(count).padStart(4, '0')}`;
  }

  async create(input: CreateProductInput): Promise<Product> {
    const code = await this.generateProductCode(input.workspaceId);
    const product = {
      ProductId: uuidv4(),
      Name: input.name,
      Code: code,
      Description: input.description,
      Benefits: input.benefits,
      UsageNotes: input.usageNotes,
      Composition: input.composition,
      UnitPrice: input.unitPrice,
      Currency: input.currency || 'XOF',
      Category: input.category,
      Unit: input.unit || 'piece',
      ImageUrl: input.imageUrl,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };
    const created = await getDb().create<Product>('products', product);
    return created;
  }

  /**
   * Récupère un produit par son UUID PK ou son business code (PRD-…).
   * Pattern dual-id du projet : permet à l'UI d'utiliser l'un ou l'autre.
   */
  async getById(idOrSlug: string): Promise<Product | null> {
    const db = getDb();
    const r = await db.query<any>(
      `SELECT * FROM products WHERE id::text = $1 OR product_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    if (r.rows.length === 0) return null;
    // Le helper list/get du client pg renvoie en PascalCase mais query<>
    // renvoie en snake_case brut. On normalise.
    return mapProductRow(r.rows[0]);
  }

  /**
   * Récupère un produit avec ses images additionnelles. Utilisé par le
   * modal détails côté POS et la page d'édition admin.
   */
  async getByIdWithDetails(idOrSlug: string): Promise<ProductWithDetails | null> {
    const db = getDb();
    const r = await db.query<any>(
      `SELECT * FROM products WHERE id::text = $1 OR product_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    if (r.rows.length === 0) return null;
    const base = mapProductRow(r.rows[0]);
    const imgsRes = await db.query<any>(
      `SELECT id, url, position FROM product_images
       WHERE product_id = $1 ORDER BY position ASC, created_at ASC`,
      [r.rows[0].id]
    );
    return {
      ...base,
      Benefits: r.rows[0].benefits ?? null,
      UsageNotes: r.rows[0].usage_notes ?? null,
      Composition: r.rows[0].composition ?? null,
      AdditionalImages: imgsRes.rows.map((row: any) => ({
        id: row.id,
        url: row.url,
        position: Number(row.position),
      })),
    };
  }

  async list(
    workspaceId: string,
    filters: { isActive?: boolean; category?: string } = {}
  ): Promise<Product[]> {
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (filters.isActive !== undefined) where.is_active = filters.isActive;
    if (filters.category) where.category = filters.category;
    return await getDb().list<Product>('products', {
      where,
      orderBy: { field: 'name', direction: 'asc' },
    });
  }

  /**
   * Met à jour un produit. Le getById cherche maintenant par UUID OU
   * business code ; on récupère donc l'UUID PK pour passer à update().
   */
  async update(idOrSlug: string, input: UpdateProductInput): Promise<Product> {
    const existing = await this.getById(idOrSlug);
    if (!existing) throw new Error('Produit non trouvé');
    const rowUuid = (existing as any).Id || existing.id;
    if (!rowUuid) throw new Error('Produit ID manquant');

    const updates: Record<string, any> = { UpdatedAt: new Date().toISOString() };
    if (input.name !== undefined)        updates.Name = input.name;
    if (input.description !== undefined) updates.Description = input.description;
    if (input.benefits !== undefined)    updates.Benefits = input.benefits;
    if (input.usageNotes !== undefined)  updates.UsageNotes = input.usageNotes;
    if (input.composition !== undefined) updates.Composition = input.composition;
    if (input.unitPrice !== undefined)   updates.UnitPrice = input.unitPrice;
    if (input.category !== undefined)    updates.Category = input.category;
    if (input.unit !== undefined)        updates.Unit = input.unit;
    if (input.imageUrl !== undefined)    updates.ImageUrl = input.imageUrl;
    if (input.isActive !== undefined)    updates.IsActive = input.isActive;

    return await getDb().update<Product>('products', rowUuid, updates);
  }

  async deactivate(idOrSlug: string): Promise<Product> {
    return await this.update(idOrSlug, { isActive: false });
  }

  async activate(idOrSlug: string): Promise<Product> {
    return await this.update(idOrSlug, { isActive: true });
  }

  async search(workspaceId: string, query: string): Promise<Product[]> {
    const products = await this.list(workspaceId, { isActive: true });
    if (!query) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.Name.toLowerCase().includes(q) ||
        p.Code.toLowerCase().includes(q) ||
        p.Description?.toLowerCase().includes(q)
    );
  }

  // ===== Images additionnelles (carrousel POS) =====

  async addImage(productIdOrSlug: string, url: string, position?: number): Promise<ProductImage> {
    const product = await this.getById(productIdOrSlug);
    if (!product) throw new Error('Produit non trouvé');
    const productUuid = (product as any).Id || product.id;
    const db = getDb();
    // Position par défaut = max + 1 (append).
    const pos = position ?? (await (async () => {
      const r = await db.query<any>(
        `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM product_images WHERE product_id = $1`,
        [productUuid]
      );
      return Number(r.rows[0].next);
    })());
    const r = await db.query<any>(
      `INSERT INTO product_images (product_id, url, position)
       VALUES ($1, $2, $3) RETURNING id, url, position`,
      [productUuid, url, pos]
    );
    return { id: r.rows[0].id, url: r.rows[0].url, position: Number(r.rows[0].position) };
  }

  async removeImage(imageId: string): Promise<void> {
    await getDb().query(`DELETE FROM product_images WHERE id = $1`, [imageId]);
  }
}

/**
 * Convertit une ligne snake_case (SELECT *) en Product PascalCase comme
 * le ferait le wrapper list/create du client pg. Nécessaire car query<>
 * ne fait pas la conversion auto.
 */
function mapProductRow(row: any): Product {
  return {
    id: row.id,
    Id: row.id,
    ProductId: row.product_id,
    Name: row.name,
    Code: row.code,
    Description: row.description,
    UnitPrice: row.unit_price !== null ? Number(row.unit_price) : 0,
    Currency: row.currency,
    Category: row.category,
    Unit: row.unit,
    ImageUrl: row.image_url,
    IsActive: row.is_active,
    WorkspaceId: row.workspace_id,
    CreatedAt: row.created_at,
    UpdatedAt: row.updated_at,
  } as Product;
}
