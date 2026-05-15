/**
 * Service — Ajustements d'inventaire matières premières
 *
 * Une fonction simple : ajuster le stock courant d'un ingrédient au niveau
 * compté physiquement, en traçant l'écart dans ingredient_adjustments.
 *
 * Transactionnel : la mise à jour de ingredients.current_stock et l'INSERT
 * dans ingredient_adjustments sont atomiques.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();

export interface AdjustIngredientInput {
  workspaceId: string;       // UUID PK
  ingredientId: string;      // UUID PK ou business code
  countedStock: number;      // Quantité physique relevée
  reason?: string;           // ex: "perte", "casse", "écart positif inventaire mensuel"
  processedById: string;     // UUID PK ou user_id business code
}

export class IngredientAdjustmentService {
  /**
   * Ajuste le stock courant à la quantité comptée. Idempotent : appeler avec
   * countedStock = stock actuel ne crée rien (delta = 0).
   */
  async adjust(input: AdjustIngredientInput): Promise<any> {
    // Résolution UUIDs
    const ingR = await db.query<any>(
      `SELECT id, name, unit, current_stock FROM ingredients
       WHERE (id::text = $1 OR ingredient_id = $1) AND workspace_id = $2
       LIMIT 1`,
      [input.ingredientId, input.workspaceId]
    );
    if (ingR.rows.length === 0) throw new Error('Ingrédient introuvable');
    const ing = ingR.rows[0];

    const before = Number(ing.current_stock);
    const after = Number(input.countedStock);
    const delta = +(after - before).toFixed(3);

    if (Math.abs(delta) < 0.001) {
      return { applied: false, ingredient: ing, delta: 0 };
    }

    const userR = await db.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [input.processedById]
    );
    if (userR.rows.length === 0) throw new Error('Utilisateur introuvable');
    const userUuid = userR.rows[0].id;

    return await db.transaction(async (client) => {
      await client.query(
        `UPDATE ingredients SET current_stock = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [ing.id, after]
      );
      const r = await client.query(
        `INSERT INTO ingredient_adjustments (
           adjustment_id, ingredient_id, qty_delta, stock_before, stock_after,
           reason, processed_by_id, workspace_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [`IA-${uuidv4().slice(0, 8)}`, ing.id, delta, before, after, input.reason ?? null, userUuid, input.workspaceId]
      );
      return { applied: true, ingredient: ing, delta, adjustment: r.rows[0] };
    });
  }

  /**
   * Historique des ajustements d'un ingrédient (ou de tout le workspace si
   * ingredientId omis), trié du plus récent au plus ancien.
   */
  async list(workspaceId: string, filters: { ingredientId?: string; limit?: number } = {}): Promise<any[]> {
    const conds: string[] = ['ia.workspace_id = $1'];
    const params: any[] = [workspaceId];
    if (filters.ingredientId) {
      const ingR = await db.query<any>(
        `SELECT id FROM ingredients WHERE id::text = $1 OR ingredient_id = $1 LIMIT 1`,
        [filters.ingredientId]
      );
      if (ingR.rows[0]) { params.push(ingR.rows[0].id); conds.push(`ia.ingredient_id = $${params.length}`); }
    }
    const r = await db.query<any>(
      `SELECT ia.id, ia.adjustment_id, ia.qty_delta, ia.stock_before, ia.stock_after,
              ia.reason, ia.processed_at,
              i.name AS ingredient_name, i.unit AS ingredient_unit, i.ingredient_id AS ingredient_slug,
              u.full_name AS processed_by_name
       FROM ingredient_adjustments ia
       JOIN ingredients i ON i.id = ia.ingredient_id
       LEFT JOIN users u ON u.id = ia.processed_by_id
       WHERE ${conds.join(' AND ')}
       ORDER BY ia.processed_at DESC
       LIMIT ${filters.limit ?? 200}`,
      params
    );
    return r.rows;
  }
}
