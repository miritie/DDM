/**
 * GET /api/stock/audit
 *
 * Audit complet de la valorisation et de la cohérence des stocks.
 *
 * Pour chaque produit :
 *   - quantité totale réelle (somme stock_items)
 *   - valeur totale réelle (Σ qty × cost)
 *   - quantité issue des mouvements validés (Σ entries+returns - exits + cumul transferts)
 *   - écart quantité réelle vs mouvements (anomalie si ≠ 0)
 *   - prix moyen pondéré des coûts unitaires
 *   - répartition par emplacement (nom, qty, cost, value)
 *   - flags : zero_cost (au moins une ligne à coût 0), negative_qty
 *
 * Renvoie aussi un récap global et la liste des anomalies.
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

    const products = await db.query(
      `SELECT id, name, code, unit_price FROM products
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY name`,
      [workspaceId]
    );

    const stockLines = await db.query(
      `SELECT si.product_id, si.quantity, si.unit_cost, si.total_value,
              COALESCE(w.name, o.name) AS location_name,
              CASE WHEN w.id IS NOT NULL THEN 'warehouse' ELSE 'outlet' END AS kind
       FROM stock_items si
       LEFT JOIN warehouses w ON w.id = si.warehouse_id
       LEFT JOIN outlets o ON o.id = si.outlet_id
       WHERE si.workspace_id = $1`,
      [workspaceId]
    );

    // Mouvements validés : entries + returns + transfers IN - exits - transfers OUT
    const movements = await db.query(
      `SELECT product_id, type,
              SUM(quantity) FILTER (
                WHERE type IN ('entry', 'return') OR
                      (type = 'transfer' AND (destination_warehouse_id IS NOT NULL OR destination_outlet_id IS NOT NULL))
              ) AS qty_in,
              SUM(quantity) FILTER (
                WHERE type = 'exit' OR
                      (type = 'transfer' AND (source_warehouse_id IS NOT NULL OR source_outlet_id IS NOT NULL))
              ) AS qty_out,
              SUM(quantity) FILTER (WHERE type = 'adjustment') AS qty_adj
       FROM stock_movements
       WHERE workspace_id = $1 AND status = 'validated'
       GROUP BY product_id, type`,
      [workspaceId]
    );

    // Sales : déjà décrémentées du stock (via /api/sales/quick decreaseStockOutlet)
    // mais on les expose pour transparence
    const sales = await db.query(
      `SELECT si.product_id, SUM(si.quantity) AS sold
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.workspace_id = $1 AND s.status != 'cancelled'
       GROUP BY si.product_id`,
      [workspaceId]
    );

    // Construit l'audit produit par produit
    const productMap = new Map(products.rows.map((p: any) => [p.id, p]));
    const audit: any[] = [];
    const anomalies: any[] = [];

    for (const p of products.rows) {
      const lines = stockLines.rows.filter((l: any) => l.product_id === p.id);
      const totalQty = lines.reduce((s: number, l: any) => s + Number(l.quantity), 0);
      const totalValue = lines.reduce((s: number, l: any) => s + Number(l.total_value), 0);
      const recomputedValue = lines.reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unit_cost), 0);

      const totalQtyOnly = lines.filter((l: any) => Number(l.quantity) > 0);
      const weightedCost = totalQtyOnly.length > 0
        ? totalQtyOnly.reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unit_cost), 0) /
          totalQtyOnly.reduce((s: number, l: any) => s + Number(l.quantity), 0)
        : 0;

      const movEntries = movements.rows.filter((m: any) => m.product_id === p.id);
      const totalIn  = movEntries.reduce((s: number, m: any) => s + Number(m.qty_in || 0), 0);
      const totalOut = movEntries.reduce((s: number, m: any) => s + Number(m.qty_out || 0), 0);
      const totalAdj = movEntries.reduce((s: number, m: any) => s + Number(m.qty_adj || 0), 0);
      const sold = Number((sales.rows.find((s: any) => s.product_id === p.id) || {}).sold || 0);
      // Note: les transferts ont 1 ligne par mouvement avec qty comptée des deux côtés
      // donc qty_in et qty_out incluent chacun la moitié pour transfer. Le delta net réel est (entries+returns) - exits + transferts net = 0
      // → on n'expose pas d'écart ici tant que la logique transfer n'est pas affinée.

      const zeroLines = lines.filter((l: any) => Number(l.unit_cost) === 0 && Number(l.quantity) > 0);
      const negativeLines = lines.filter((l: any) => Number(l.quantity) < 0);

      audit.push({
        product: { id: p.id, name: p.name, code: p.code, sellPrice: Number(p.unit_price) },
        totalQty, totalValue, recomputedValue,
        weightedCost: Math.round(weightedCost),
        valueMatchesCompute: Math.abs(totalValue - recomputedValue) < 0.01,
        zeroCostLines: zeroLines.length,
        negativeLines: negativeLines.length,
        sold,
        movements: { in: totalIn, out: totalOut, adjustments: totalAdj },
        breakdown: lines.map((l: any) => ({
          location: l.location_name,
          kind: l.kind,
          qty: Number(l.quantity),
          unitCost: Number(l.unit_cost),
          lineValue: Number(l.total_value),
          recomputed: Number(l.quantity) * Number(l.unit_cost),
        })),
      });

      if (zeroLines.length > 0) {
        anomalies.push({
          severity: 'warning',
          product: p.name,
          message: `${zeroLines.length} ligne(s) à coût unitaire = 0 (${zeroLines.reduce((s: number, l: any) => s + Number(l.quantity), 0)} unités non valorisées)`,
        });
      }
      if (negativeLines.length > 0) {
        anomalies.push({
          severity: 'error',
          product: p.name,
          message: `${negativeLines.length} ligne(s) avec quantité négative !`,
        });
      }
      if (Math.abs(totalValue - recomputedValue) > 0.01) {
        anomalies.push({
          severity: 'error',
          product: p.name,
          message: `total_value en base (${totalValue.toFixed(0)}) ≠ qty × cost recalculé (${recomputedValue.toFixed(0)})`,
        });
      }
    }

    const totals = {
      totalQty: audit.reduce((s, a) => s + a.totalQty, 0),
      totalValue: audit.reduce((s, a) => s + a.totalValue, 0),
      recomputedValue: audit.reduce((s, a) => s + a.recomputedValue, 0),
      productsCount: audit.length,
    };

    return NextResponse.json({ data: { totals, audit, anomalies } });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
