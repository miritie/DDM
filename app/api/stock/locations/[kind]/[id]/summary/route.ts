/**
 * GET /api/stock/locations/[kind]/[id]/summary
 *
 * Vue focalisée d'un emplacement (entrepôt ou stand) :
 *   - infos de base (nom, code, type)
 *   - KPIs (nb articles, valeur totale, faibles, ruptures)
 *   - lignes stock_items enrichies (produit, statut)
 *   - 10 derniers mouvements
 *
 * Accepte UUID PK ou slug métier (warehouse_id / code) pour le param [id].
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { kind, id } = await params;

    if (kind !== 'warehouse' && kind !== 'outlet') {
      return NextResponse.json({ error: `Type invalide : ${kind}` }, { status: 400 });
    }

    // Résolution kind + (UUID|slug) → UUID PK
    const locTable = kind === 'warehouse' ? 'warehouses' : 'outlets';
    const slugCol  = kind === 'warehouse' ? 'warehouse_id' : 'code';
    const locRes = await db.query(
      `SELECT id, name, ${slugCol} AS slug
       FROM ${locTable}
       WHERE workspace_id = $1 AND (id::text = $2 OR ${slugCol} = $2)
       LIMIT 1`,
      [workspaceId, id]
    );
    if (locRes.rows.length === 0) {
      return NextResponse.json({ error: `${kind} introuvable : ${id}` }, { status: 404 });
    }
    const loc = locRes.rows[0];

    // Stock items + produit joints
    const fkCol = kind === 'warehouse' ? 'warehouse_id' : 'outlet_id';
    const stockRes = await db.query(
      `SELECT si.id, si.stock_item_id, si.quantity, si.minimum_stock, si.maximum_stock,
              si.unit_cost, si.total_value, si.last_restock_date, si.updated_at,
              p.id AS product_pk, p.product_id AS product_code, p.name AS product_name, p.code AS product_sku,
              p.unit_price AS product_unit_price, p.image_url AS product_image_url
       FROM stock_items si
       JOIN products p ON p.id = si.product_id
       WHERE si.workspace_id = $1 AND si.${fkCol} = $2
       ORDER BY p.name ASC`,
      [workspaceId, loc.id]
    );

    // 10 derniers mouvements sur cet emplacement
    const movFkCols = kind === 'warehouse'
      ? ['source_warehouse_id', 'destination_warehouse_id']
      : ['source_outlet_id', 'destination_outlet_id'];
    const movRes = await db.query(
      `SELECT m.id, m.movement_number, m.type, m.quantity, m.unit_cost, m.total_cost,
              m.reason, m.status, m.processed_at,
              m.${movFkCols[0]} AS source_id,
              m.${movFkCols[1]} AS dest_id,
              p.name AS product_name, p.code AS product_sku,
              u.full_name AS processed_by_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.processed_by_id
       WHERE m.workspace_id = $1
         AND (m.${movFkCols[0]} = $2 OR m.${movFkCols[1]} = $2)
       ORDER BY m.processed_at DESC NULLS LAST, m.created_at DESC
       LIMIT 10`,
      [workspaceId, loc.id]
    );

    // KPIs calculés côté serveur
    const items = stockRes.rows;
    const kpis = {
      itemsCount:      items.length,
      totalValue:      items.reduce((s, r) => s + Number(r.total_value || 0), 0),
      totalQuantity:   items.reduce((s, r) => s + Number(r.quantity || 0), 0),
      lowStockCount:   items.filter(r => Number(r.quantity) > 0 && Number(r.quantity) <= Number(r.minimum_stock)).length,
      outOfStockCount: items.filter(r => Number(r.quantity) === 0).length,
    };

    return NextResponse.json({
      data: {
        location: {
          id: loc.id,
          slug: loc.slug,
          name: loc.name,
          kind,
        },
        kpis,
        items: items.map(r => ({
          id: r.id,
          stockItemId: r.stock_item_id,
          quantity: Number(r.quantity),
          minimumStock: Number(r.minimum_stock),
          maximumStock: r.maximum_stock !== null ? Number(r.maximum_stock) : null,
          unitCost: Number(r.unit_cost),
          totalValue: Number(r.total_value),
          lastRestockDate: r.last_restock_date,
          updatedAt: r.updated_at,
          product: {
            id: r.product_pk,
            code: r.product_code,
            name: r.product_name,
            sku: r.product_sku,
            unitPrice: r.product_unit_price !== null ? Number(r.product_unit_price) : null,
            imageUrl: r.product_image_url,
          },
        })),
        recentMovements: movRes.rows.map(r => ({
          id: r.id,
          movementNumber: r.movement_number,
          type: r.type,
          quantity: Number(r.quantity),
          unitCost: Number(r.unit_cost),
          totalCost: Number(r.total_cost),
          reason: r.reason,
          status: r.status,
          processedAt: r.processed_at,
          processedByName: r.processed_by_name,
          direction: r.source_id === loc.id ? 'out' : 'in',
          product: { name: r.product_name, sku: r.product_sku },
        })),
      },
    });
  } catch (error: any) {
    console.error('Stock location summary error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
