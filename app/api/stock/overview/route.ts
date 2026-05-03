/**
 * GET /api/stock/overview
 *
 * Renvoie une matrice produits × emplacements pour visualiser tout le stock du workspace
 * en une seule vue. Avec totaux par produit (cumul) et par emplacement.
 *
 * Format :
 *   {
 *     products: [{ id, name, code }],
 *     locations: [{ id, name, kind: 'warehouse' | 'outlet' }],
 *     stock: { [productId]: { [locationId]: { qty, totalValue } } },
 *     totalsByProduct:  { [productId]: { qty, totalValue } },
 *     totalsByLocation: { [locationId]: { qty, totalValue } },
 *     grandTotal: { qty, totalValue, productsCount, locationsCount }
 *   }
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

    const [productsRes, warehousesRes, outletsRes, stockRes] = await Promise.all([
      db.query(
        `SELECT id, name, code FROM products
         WHERE workspace_id = $1 AND is_active = true
         ORDER BY name`,
        [workspaceId]
      ),
      db.query(
        `SELECT id, name FROM warehouses
         WHERE workspace_id = $1 AND is_active = true
         ORDER BY name`,
        [workspaceId]
      ),
      db.query(
        `SELECT id, name FROM outlets
         WHERE workspace_id = $1 AND is_active = true
         ORDER BY name`,
        [workspaceId]
      ),
      db.query(
        `SELECT product_id, warehouse_id, outlet_id, quantity, total_value
         FROM stock_items WHERE workspace_id = $1`,
        [workspaceId]
      ),
    ]);

    const products = productsRes.rows;
    const locations = [
      ...warehousesRes.rows.map((w: any) => ({ id: w.id, name: w.name, kind: 'warehouse' as const })),
      ...outletsRes.rows.map((o: any) => ({ id: o.id, name: o.name, kind: 'outlet' as const })),
    ];

    // Indexation : stock[productId][locationId] = { qty, totalValue }
    const stock: Record<string, Record<string, { qty: number; totalValue: number }>> = {};
    const totalsByProduct: Record<string, { qty: number; totalValue: number }> = {};
    const totalsByLocation: Record<string, { qty: number; totalValue: number }> = {};
    let grandQty = 0, grandValue = 0;

    for (const p of products) totalsByProduct[p.id] = { qty: 0, totalValue: 0 };
    for (const l of locations) totalsByLocation[l.id] = { qty: 0, totalValue: 0 };

    for (const r of stockRes.rows) {
      const productId = r.product_id;
      const locationId = r.warehouse_id || r.outlet_id;
      if (!locationId || !totalsByProduct[productId] || !totalsByLocation[locationId]) continue;

      const qty = Number(r.quantity);
      const value = Number(r.total_value);

      if (!stock[productId]) stock[productId] = {};
      stock[productId][locationId] = { qty, totalValue: value };

      totalsByProduct[productId].qty += qty;
      totalsByProduct[productId].totalValue += value;
      totalsByLocation[locationId].qty += qty;
      totalsByLocation[locationId].totalValue += value;
      grandQty += qty;
      grandValue += value;
    }

    return NextResponse.json({
      data: {
        products, locations, stock,
        totalsByProduct, totalsByLocation,
        grandTotal: {
          qty: grandQty, totalValue: grandValue,
          productsCount: products.length,
          locationsCount: locations.length,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
