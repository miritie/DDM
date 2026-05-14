/**
 * API Routes - Mouvements de Stock
 *
 * GET  /api/stock/movements         — liste filtrable
 * POST /api/stock/movements         — crée un mouvement multi-lignes
 *
 * Body POST attendu :
 *   {
 *     type: 'entry' | 'exit' | 'transfer' | 'adjustment' | 'return',
 *     sourceWarehouseId?, destinationWarehouseId?,        // PK UUID OU slug warehouse_id
 *     sourceOutletId?,    destinationOutletId?,           // PK UUID OU code
 *     lines: [{ productId, quantity, unitCost? }],
 *     notes?, reference?
 *   }
 *
 * Pour chaque ligne :
 *   1. crée une entrée stock_movements (status='validated')
 *   2. met à jour stock_items source/destination selon le type
 *   Toutes les valeurs slug sont résolues en UUID au préalable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { StockMovementService } from '@/lib/modules/stock/stock-movement-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const service = new StockMovementService();
const db = getPostgresClient();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUserUuid(idOrSlug: string): Promise<string | null> {
  if (UUID_RE.test(idOrSlug)) return idOrSlug;
  const r = await db.query(`SELECT id FROM users WHERE user_id = $1 OR email = $1 LIMIT 1`, [idOrSlug]);
  return r.rows[0]?.id ?? null;
}

async function resolveWarehouseUuid(idOrSlug?: string | null): Promise<string | null> {
  if (!idOrSlug) return null;
  const r = await db.query(
    `SELECT id FROM warehouses WHERE id::text = $1 OR warehouse_id = $1 OR code = $1 LIMIT 1`,
    [idOrSlug]
  );
  return r.rows[0]?.id ?? null;
}

async function resolveOutletUuid(idOrSlug?: string | null): Promise<string | null> {
  if (!idOrSlug) return null;
  const r = await db.query(
    `SELECT id FROM outlets WHERE id::text = $1 OR code = $1 LIMIT 1`,
    [idOrSlug]
  );
  return r.rows[0]?.id ?? null;
}

async function resolveProductUuid(idOrSlug: string): Promise<string | null> {
  if (UUID_RE.test(idOrSlug)) return idOrSlug;
  const r = await db.query(
    `SELECT id FROM products WHERE product_id = $1 OR code = $1 LIMIT 1`,
    [idOrSlug]
  );
  return r.rows[0]?.id ?? null;
}

/**
 * Coût unitaire intelligent quand non fourni :
 *  1) coût existant pour ce produit sur l'emplacement source (transfert)
 *  2) moyenne pondérée des autres lignes stock du même produit
 *  3) fallback : 50% du prix de vente du produit
 */
async function resolveUnitCost(
  productUuid: string,
  sourceLocationCol: 'warehouse_id' | 'outlet_id' | null,
  sourceLocationId: string | null
): Promise<number> {
  if (sourceLocationCol && sourceLocationId) {
    const r = await db.query(
      `SELECT unit_cost FROM stock_items WHERE product_id = $1 AND ${sourceLocationCol} = $2 AND unit_cost > 0 LIMIT 1`,
      [productUuid, sourceLocationId]
    );
    if (r.rows.length > 0) return Number(r.rows[0].unit_cost);
  }
  const avg = await db.query(
    `SELECT SUM(quantity * unit_cost) / NULLIF(SUM(quantity), 0) AS weighted
     FROM stock_items WHERE product_id = $1 AND unit_cost > 0 AND quantity > 0`,
    [productUuid]
  );
  if (avg.rows[0]?.weighted) return Number(avg.rows[0].weighted);

  const p = await db.query(`SELECT unit_price FROM products WHERE id = $1`, [productUuid]);
  return Number(p.rows[0]?.unit_price || 0) * 0.5;
}

/** Augmente ou crée une ligne stock_items pour (product, location). */
async function increaseStock(workspaceId: string, productUuid: string, locationKind: 'warehouse' | 'outlet', locationId: string, qty: number, unitCost: number) {
  const col = locationKind === 'warehouse' ? 'warehouse_id' : 'outlet_id';
  const existing = await db.query(
    `SELECT id, quantity FROM stock_items WHERE product_id = $1 AND ${col} = $2 LIMIT 1`,
    [productUuid, locationId]
  );
  if (existing.rows.length > 0) {
    const newQty = Number(existing.rows[0].quantity) + qty;
    await db.query(
      `UPDATE stock_items
       SET quantity = $2, total_value = $2 * unit_cost, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [existing.rows[0].id, newQty]
    );
  } else {
    // total_value pré-calculé côté JS pour éviter l'ambiguïté de type Postgres.
    const totalValue = qty * unitCost;
    await db.query(
      `INSERT INTO stock_items
        (stock_item_id, product_id, ${col}, quantity, minimum_stock,
         unit_cost, total_value, workspace_id)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [`STK-${uuidv4().slice(0, 8)}`, productUuid, locationId, qty, unitCost, totalValue, workspaceId]
    );
  }
}

/** Décrémente le stock — refuse si insuffisant. */
async function decreaseStock(productUuid: string, locationKind: 'warehouse' | 'outlet', locationId: string, qty: number) {
  const col = locationKind === 'warehouse' ? 'warehouse_id' : 'outlet_id';
  const existing = await db.query(
    `SELECT id, quantity FROM stock_items WHERE product_id = $1 AND ${col} = $2 LIMIT 1`,
    [productUuid, locationId]
  );
  if (existing.rows.length === 0) {
    throw new Error(`Aucun stock pour ce produit sur l'emplacement source`);
  }
  const current = Number(existing.rows[0].quantity);
  if (current < qty) {
    throw new Error(`Stock insuffisant : ${current} disponible, ${qty} demandé`);
  }
  await db.query(
    `UPDATE stock_items
     SET quantity = $2, total_value = $2 * unit_cost, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [existing.rows[0].id, current - qty]
  );
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const filters: any = {};
    for (const k of ['type', 'productId', 'warehouseId', 'status', 'dateFrom', 'dateTo']) {
      const v = searchParams.get(k);
      if (v) filters[k] = v;
    }
    const movements = await service.list(workspaceId, filters);
    return NextResponse.json({ data: movements });
  } catch (error: any) {
    console.error('Error fetching movements:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_CREATE);
    const user = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const { type, lines, notes, reference } = body;
    if (!type) return NextResponse.json({ error: 'type requis' }, { status: 400 });
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 });
    }

    // Résolution des UUIDs
    const userUuid = await resolveUserUuid((user as any).userId);
    if (!userUuid) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    const sourceWh   = await resolveWarehouseUuid(body.sourceWarehouseId);
    const destWh     = await resolveWarehouseUuid(body.destinationWarehouseId);
    const sourceOut  = await resolveOutletUuid(body.sourceOutletId);
    const destOut    = await resolveOutletUuid(body.destinationOutletId);

    // Validation selon type
    if (type === 'entry' || type === 'return') {
      if (!destWh && !destOut) {
        return NextResponse.json({ error: 'Destination requise pour ' + type }, { status: 400 });
      }
    } else if (type === 'exit') {
      if (!sourceWh && !sourceOut) {
        return NextResponse.json({ error: 'Source requise pour exit' }, { status: 400 });
      }
    } else if (type === 'transfer') {
      if ((!sourceWh && !sourceOut) || (!destWh && !destOut)) {
        return NextResponse.json({ error: 'Source et destination requises pour un transfert' }, { status: 400 });
      }
    } else if (type === 'adjustment') {
      if (!destWh && !destOut) {
        return NextResponse.json({ error: 'Emplacement requis pour ajustement' }, { status: 400 });
      }
    }

    const created: any[] = [];
    const errors: any[] = [];

    for (const line of lines) {
      try {
        const productUuid = await resolveProductUuid(line.productId);
        if (!productUuid) throw new Error(`Produit introuvable : ${line.productId}`);
        const qty = Number(line.quantity);
        if (!qty || qty <= 0) throw new Error('Quantité invalide');

        // Coût unitaire : valeur fournie OU résolveur intelligent
        let unitCost = Number(line.unitCost) || 0;
        if (unitCost === 0) {
          const sourceCol = sourceWh ? 'warehouse_id' : sourceOut ? 'outlet_id' : null;
          const sourceId  = sourceWh || sourceOut;
          unitCost = await resolveUnitCost(productUuid, sourceCol as any, sourceId);
        }

        // Application du mouvement sur les stocks
        if (type === 'entry' || type === 'return') {
          if (destWh)  await increaseStock(workspaceId, productUuid, 'warehouse', destWh, qty, unitCost);
          else         await increaseStock(workspaceId, productUuid, 'outlet',    destOut!, qty, unitCost);
        } else if (type === 'exit') {
          if (sourceWh) await decreaseStock(productUuid, 'warehouse', sourceWh, qty);
          else          await decreaseStock(productUuid, 'outlet',    sourceOut!, qty);
        } else if (type === 'transfer') {
          if (sourceWh) await decreaseStock(productUuid, 'warehouse', sourceWh, qty);
          else          await decreaseStock(productUuid, 'outlet',    sourceOut!, qty);
          if (destWh)   await increaseStock(workspaceId, productUuid, 'warehouse', destWh, qty, unitCost);
          else          await increaseStock(workspaceId, productUuid, 'outlet',    destOut!, qty, unitCost);
        } else if (type === 'adjustment') {
          // 'adjustment' via cette route = +qty (à différencier de inventory/process qui set la valeur absolue)
          if (destWh)  await increaseStock(workspaceId, productUuid, 'warehouse', destWh, qty, unitCost);
          else         await increaseStock(workspaceId, productUuid, 'outlet',    destOut!, qty, unitCost);
        }

        // Trace mouvement
        const r = await db.query(
          `INSERT INTO stock_movements
            (movement_id, movement_number, type, product_id,
             source_warehouse_id, destination_warehouse_id,
             source_outlet_id, destination_outlet_id,
             quantity, unit_cost, total_cost, reason, reference, status,
             processed_by_id, processed_at, validated_by_id, validated_at, workspace_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                   'validated', $14, CURRENT_TIMESTAMP, $14, CURRENT_TIMESTAMP, $15)
           RETURNING *`,
          [
            uuidv4(),
            `MOV-${Date.now()}-${created.length}`,
            type,
            productUuid,
            sourceWh, destWh, sourceOut, destOut,
            qty, unitCost, qty * unitCost,
            notes || null, reference || null,
            userUuid, workspaceId,
          ]
        );
        created.push(r.rows[0]);
      } catch (e: any) {
        errors.push({ productId: line.productId, message: e.message });
      }
    }

    return NextResponse.json(
      { data: { created: created.length, errors, movements: created } },
      { status: errors.length > 0 ? 207 : 201 }
    );
  } catch (error: any) {
    console.error('Error creating movement:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
