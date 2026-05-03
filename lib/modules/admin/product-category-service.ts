/**
 * Service - Catégories de produits (PostgreSQL)
 */

import { getPostgresClient } from '@/lib/database/postgres-client';

export interface ProductCategory {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  color?: string;
  sortOrder?: number;
  workspaceId: string;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
}

const getDb = () => getPostgresClient();

const SELECT_FIELDS = `
  id,
  workspace_id as "workspaceId",
  name,
  color,
  sort_order as "sortOrder",
  is_active as "isActive",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

export class ProductCategoryService {
  async list(workspaceId: string, includeInactive = false): Promise<ProductCategory[]> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${SELECT_FIELDS}
       FROM product_categories
       WHERE workspace_id = $1
       ${includeInactive ? '' : 'AND is_active = true'}
       ORDER BY sort_order ASC, name ASC`,
      [workspaceId]
    );
    return result.rows;
  }

  async getById(id: string): Promise<ProductCategory | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${SELECT_FIELDS} FROM product_categories WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async create(input: CreateCategoryInput): Promise<ProductCategory> {
    const db = getDb();
    const result = await db.query(
      `INSERT INTO product_categories (workspace_id, name, color, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_FIELDS}`,
      [input.workspaceId, input.name.trim(), input.color || '#3b82f6', input.sortOrder ?? 0]
    );
    return result.rows[0];
  }

  async update(id: string, input: UpdateCategoryInput): Promise<ProductCategory> {
    const db = getDb();
    const updates: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${i++}`);
      params.push(input.name.trim());
    }
    if (input.color !== undefined) {
      updates.push(`color = $${i++}`);
      params.push(input.color);
    }
    if (input.sortOrder !== undefined) {
      updates.push(`sort_order = $${i++}`);
      params.push(input.sortOrder);
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${i++}`);
      params.push(input.isActive);
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await db.query(
      `UPDATE product_categories
       SET ${updates.join(', ')}
       WHERE id = $${i}
       RETURNING ${SELECT_FIELDS}`,
      params
    );
    return result.rows[0];
  }

  /**
   * Suppression : si la catégorie est utilisée par des produits, on désactive
   * (préserve l'intégrité des données existantes). Sinon, suppression dure.
   */
  async delete(id: string): Promise<{ deleted: boolean; deactivated: boolean; usageCount: number }> {
    const db = getDb();

    const cat = await this.getById(id);
    if (!cat) throw new Error('Catégorie introuvable');

    const usage = await db.query(
      `SELECT COUNT(*) as count FROM products
       WHERE workspace_id = $1 AND category = $2`,
      [cat.workspaceId, cat.name]
    );
    const usageCount = parseInt(usage.rows[0].count, 10);

    if (usageCount > 0) {
      await db.query(
        `UPDATE product_categories
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
      return { deleted: false, deactivated: true, usageCount };
    }

    await db.query(`DELETE FROM product_categories WHERE id = $1`, [id]);
    return { deleted: true, deactivated: false, usageCount: 0 };
  }
}
