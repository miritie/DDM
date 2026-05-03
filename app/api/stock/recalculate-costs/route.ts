/**
 * POST /api/stock/recalculate-costs
 *
 * Pour toutes les lignes stock_items à unit_cost = 0 :
 *   - applique la moyenne pondérée des autres lignes du même produit
 *   - sinon 50% du prix de vente du produit
 *   - recalcule total_value
 *
 * Utile après corrections de bug ou import en masse.
 * Renvoie le nombre de lignes corrigées et la nouvelle valeur totale.
 */
import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function POST() {
  try {
    // Maintenance idempotente sur des coûts dérivés — STOCK_VIEW suffit
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const workspaceId = await getCurrentWorkspaceId();

    const zeros = await db.query(
      `SELECT id, product_id, quantity FROM stock_items
       WHERE workspace_id = $1 AND unit_cost = 0 AND quantity > 0`,
      [workspaceId]
    );

    let updated = 0;
    for (const row of zeros.rows) {
      // moyenne pondérée des autres lignes
      const avg = await db.query(
        `SELECT SUM(quantity * unit_cost) / NULLIF(SUM(quantity), 0) AS w
         FROM stock_items
         WHERE product_id = $1 AND id != $2 AND unit_cost > 0 AND quantity > 0`,
        [row.product_id, row.id]
      );
      let cost: number;
      if (avg.rows[0]?.w) {
        cost = Number(avg.rows[0].w);
      } else {
        const p = await db.query(`SELECT unit_price FROM products WHERE id = $1`, [row.product_id]);
        cost = Number(p.rows[0]?.unit_price || 0) * 0.5;
      }
      if (cost > 0) {
        await db.query(
          `UPDATE stock_items
           SET unit_cost = $2, total_value = quantity * $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [row.id, cost]
        );
        updated++;
      }
    }

    const totals = await db.query(
      `SELECT SUM(total_value) AS total, SUM(quantity) AS qty FROM stock_items WHERE workspace_id = $1`,
      [workspaceId]
    );

    return NextResponse.json({
      data: {
        scanned: zeros.rows.length,
        updated,
        newTotalValue: Number(totals.rows[0].total),
        totalQty: Number(totals.rows[0].qty),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
