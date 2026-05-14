/**
 * GET /api/products/with-cost
 *
 * Liste produits actifs + coût de revient calculé (CUMP des stock_items).
 * Utilisé par /replenishments/new pour pré-remplir et VERROUILLER le coût.
 */

import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const workspaceId = await getCurrentWorkspaceId();

    const r = await db.query(
      `SELECT p.id, p.product_id, p.name, p.code, p.unit_price,
              COALESCE(
                SUM(si.quantity * si.unit_cost) FILTER (WHERE si.unit_cost > 0 AND si.quantity > 0)
                / NULLIF(SUM(si.quantity) FILTER (WHERE si.unit_cost > 0 AND si.quantity > 0), 0),
                0
              )::float AS cost_price,
              p.is_active
       FROM products p
       LEFT JOIN stock_items si ON si.product_id = p.id AND si.workspace_id = $1
       WHERE p.workspace_id = $1 AND p.is_active = true
       GROUP BY p.id
       ORDER BY p.name ASC`,
      [workspaceId]
    );

    return NextResponse.json({
      data: r.rows.map(p => ({
        id: p.id,
        code: p.code,
        productId: p.product_id,
        name: p.name,
        unitPrice: Number(p.unit_price),
        costPrice: Number(p.cost_price) > 0 ? Number(p.cost_price) : Number(p.unit_price) * 0.5,
        isActive: p.is_active,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 });
  }
}
