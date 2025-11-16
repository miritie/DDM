/**
 * Service - Gestion des Produits
 * Module Ventes & Encaissements
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Product } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateProductInput {
  name: string;
  description?: string;
  unitPrice: number;
  currency?: string;
  category?: string;
  unit?: string;
  workspaceId: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  unitPrice?: number;
  category?: string;
  unit?: string;
  isActive?: boolean;
}

/**
 * Service de gestion des produits
 */
export class ProductService {
  /**
   * Génère un code produit unique
   */
  async generateProductCode(workspaceId: string): Promise<string> {
    const products = await airtableClient.list<Product>('Product', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });

    const count = products.length + 1;
    return `PRD-${String(count).padStart(4, '0')}`;
  }

  /**
   * Crée un nouveau produit
   */
  async create(input: CreateProductInput): Promise<Product> {
    const code = await this.generateProductCode(input.workspaceId);

    const product: Partial<Product> = {
      ProductId: uuidv4(),
      Name: input.name,
      Code: code,
      Description: input.description,
      UnitPrice: input.unitPrice,
      Currency: input.currency || 'XOF',
      Category: input.category,
      Unit: input.unit || 'piece',
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<Product>('Product', product);
  }

  /**
   * Récupère un produit par ID
   */
  async getById(productId: string): Promise<Product | null> {
    const products = await airtableClient.list<Product>('Product', {
      filterByFormula: `{ProductId} = '${productId}'`,
    });

    return products.length > 0 ? products[0] : null;
  }

  /**
   * Liste tous les produits d'un workspace
   */
  async list(
    workspaceId: string,
    filters: { isActive?: boolean; category?: string } = {}
  ): Promise<Product[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.isActive !== undefined) {
      filterFormulas.push(`{IsActive} = ${filters.isActive ? 1 : 0}`);
    }

    if (filters.category) {
      filterFormulas.push(`{Category} = '${filters.category}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await airtableClient.list<Product>('Product', {
      filterByFormula,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Met à jour un produit
   */
  async update(productId: string, input: UpdateProductInput): Promise<Product> {
    const products = await airtableClient.list<Product>('Product', {
      filterByFormula: `{ProductId} = '${productId}'`,
    });

    if (products.length === 0) {
      throw new Error('Produit non trouvé');
    }

    const updates: Partial<Product> = {
      ...input,
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.update<Product>(
      'Product',
      (products[0] as any)._recordId,
      updates
    );
  }

  /**
   * Désactive un produit
   */
  async deactivate(productId: string): Promise<Product> {
    return await this.update(productId, { isActive: false });
  }

  /**
   * Active un produit
   */
  async activate(productId: string): Promise<Product> {
    return await this.update(productId, { isActive: true });
  }

  /**
   * Recherche de produits par nom
   */
  async search(workspaceId: string, query: string): Promise<Product[]> {
    const products = await this.list(workspaceId, { isActive: true });

    if (!query) return products;

    const lowercaseQuery = query.toLowerCase();
    return products.filter(
      (p) =>
        p.Name.toLowerCase().includes(lowercaseQuery) ||
        p.Code.toLowerCase().includes(lowercaseQuery) ||
        p.Description?.toLowerCase().includes(lowercaseQuery)
    );
  }
}
