/**
 * GET /api/stock/outlets
 *
 * Liste minimale des stands pour la page `/stock/outlets`.
 * Exige STOCK_VIEW (et pas OUTLET_VIEW) — la table outlets est juste utilisée
 * comme dimension du stock.
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
      `SELECT o.id, o.code, o.name, o.city, o.is_active,
              ot.name AS type_name,
              COALESCE(SUM(si.quantity), 0)::float    AS total_qty,
              COALESCE(SUM(si.total_value), 0)::float AS total_value,
              COUNT(si.id) FILTER (WHERE si.quantity > 0)                       AS lines_with_stock,
              COUNT(si.id) FILTER (WHERE si.quantity = 0)                       AS lines_out,
              COUNT(si.id) FILTER (WHERE si.quantity > 0 AND si.quantity <= si.minimum_stock) AS lines_low
       FROM outlets o
       LEFT JOIN outlet_types ot ON ot.id = o.outlet_type_id
       LEFT JOIN stock_items si  ON si.outlet_id = o.id AND si.workspace_id = $1
       WHERE o.workspace_id = $1
       GROUP BY o.id, ot.name
       ORDER BY o.is_active DESC, o.name ASC`,
      [workspaceId]
    );

    return NextResponse.json({
      data: r.rows.map(row => ({
        id: row.id,
        slug: row.code,
        name: row.name,
        city: row.city,
        typeName: row.type_name,
        isActive: row.is_active,
        totalQty: Number(row.total_qty),
        totalValue: Number(row.total_value),
        linesWithStock: Number(row.lines_with_stock),
        linesOut: Number(row.lines_out),
        linesLow: Number(row.lines_low),
      })),
    });
  } catch (error: any) {
    console.error('Stock outlets list error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
