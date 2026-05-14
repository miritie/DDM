/**
 * POST /api/stock/receive
 *
 * Réception de stock par un commercial sur son outlet courant.
 * Cas d'usage : un commercial reçoit physiquement de la marchandise (depuis l'usine,
 * depuis un autre outlet, ou ad-hoc) et l'ajoute à son stock outlet.
 *
 * Body :
 *   {
 *     outletId: string,                                  // outlet sur lequel on reçoit
 *     fromWarehouseId? | fromOutletId?: string,          // optionnel — origine
 *     lines: [{ productId, quantity, unitCost? }],
 *     notes?: string
 *   }
 *
 * Crée un mouvement par ligne, type='entry' (sans source) ou 'transfer' (avec source).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUuid(table: string, slugCol: string, value: string): Promise<string | null> {
  if (UUID_RE.test(value)) return value;
  const r = await db.query(`SELECT id FROM ${table} WHERE id::text = $1 OR ${slugCol} = $1 LIMIT 1`, [value]);
  return r.rows[0]?.id ?? null;
}

async function resolveUnitCost(productUuid: string, sourceCol: string | null, sourceId: string | null): Promise<number> {
  if (sourceCol && sourceId) {
    const r = await db.query(
      `SELECT unit_cost FROM stock_items WHERE product_id = $1 AND ${sourceCol} = $2 AND unit_cost > 0 LIMIT 1`,
      [productUuid, sourceId]
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

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE); // un commercial qui peut vendre peut réceptionner
    const workspaceId = await getCurrentWorkspaceId();
    const user = await getCurrentUser();
    const body = await request.json();

    const { outletId, fromWarehouseId, fromOutletId, lines, notes } = body;
    if (!outletId) return NextResponse.json({ error: 'outletId requis' }, { status: 400 });
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 });
    }

    const outletUuid = await resolveUuid('outlets', 'code', outletId);
    if (!outletUuid) return NextResponse.json({ error: `Outlet introuvable : ${outletId}` }, { status: 404 });

    let sourceWarehouseUuid: string | null = null;
    let sourceOutletUuid: string | null = null;
    if (fromWarehouseId) sourceWarehouseUuid = await resolveUuid('warehouses', 'warehouse_id', fromWarehouseId);
    if (fromOutletId)    sourceOutletUuid    = await resolveUuid('outlets', 'code', fromOutletId);

    // Résoud user (slug → UUID)
    const ur = await db.query(`SELECT id FROM users WHERE user_id = $1 OR email = $1 LIMIT 1`, [(user as any).userId]);
    if (ur.rows.length === 0) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    const userUuid = ur.rows[0].id;

    const created: any[] = [];
    const errors: any[] = [];

    for (const line of lines) {
      try {
        const productUuid = await resolveUuid('products', 'product_id', line.productId);
        if (!productUuid) throw new Error(`Produit introuvable : ${line.productId}`);
        const qty = Number(line.quantity);
        if (!qty || qty <= 0) throw new Error('Quantité invalide');
        let unitCost = Number(line.unitCost) || 0;
        if (unitCost === 0) {
          const sCol = sourceWarehouseUuid ? 'warehouse_id' : sourceOutletUuid ? 'outlet_id' : null;
          const sId  = sourceWarehouseUuid || sourceOutletUuid;
          unitCost = await resolveUnitCost(productUuid, sCol, sId);
        }

        const isTransfer = !!(sourceWarehouseUuid || sourceOutletUuid);
        const movementType = isTransfer ? 'transfer' : 'entry';

        // Si transfert, décrémente la source (vérifie le stock dispo)
        if (isTransfer) {
          const sourceCol = sourceWarehouseUuid ? 'warehouse_id' : 'outlet_id';
          const sourceId = sourceWarehouseUuid || sourceOutletUuid;
          const sExisting = await db.query(
            `SELECT id, quantity FROM stock_items WHERE product_id = $1 AND ${sourceCol} = $2 LIMIT 1`,
            [productUuid, sourceId]
          );
          if (sExisting.rows.length === 0) throw new Error(`Aucun stock source pour ce produit`);
          const cur = Number(sExisting.rows[0].quantity);
          if (cur < qty) throw new Error(`Stock source insuffisant : ${cur} < ${qty}`);
          await db.query(
            `UPDATE stock_items
             SET quantity = $2, total_value = $2 * unit_cost, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [sExisting.rows[0].id, cur - qty]
          );
        }

        // Augmente le stock outlet destination
        const dExisting = await db.query(
          `SELECT id, quantity FROM stock_items WHERE product_id = $1 AND outlet_id = $2 LIMIT 1`,
          [productUuid, outletUuid]
        );
        if (dExisting.rows.length > 0) {
          const newQty = Number(dExisting.rows[0].quantity) + qty;
          await db.query(
            `UPDATE stock_items SET quantity = $2, total_value = $2 * unit_cost,
             updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [dExisting.rows[0].id, newQty]
          );
        } else {
          // total_value pré-calculé côté JS pour éviter l'ambiguïté de type Postgres.
          const totalValue = qty * unitCost;
          await db.query(
            `INSERT INTO stock_items
              (stock_item_id, product_id, outlet_id, quantity, minimum_stock,
               unit_cost, total_value, workspace_id)
             VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
            [`STK-${uuidv4().slice(0, 8)}`, productUuid, outletUuid, qty, unitCost, totalValue, workspaceId]
          );
        }

        // Trace mouvement
        const r = await db.query(
          `INSERT INTO stock_movements
            (movement_id, movement_number, type, product_id,
             source_warehouse_id, destination_warehouse_id,
             source_outlet_id, destination_outlet_id,
             quantity, unit_cost, total_cost, reason, status,
             processed_by_id, processed_at, validated_by_id, validated_at, workspace_id)
           VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10, $11,
                   'validated', $12, CURRENT_TIMESTAMP, $12, CURRENT_TIMESTAMP, $13)
           RETURNING *`,
          [
            uuidv4(),
            `RCP-${Date.now()}-${created.length}`,
            movementType,
            productUuid,
            sourceWarehouseUuid,
            sourceOutletUuid,
            outletUuid,
            qty, unitCost, qty * unitCost,
            notes || `Réception sur outlet par commercial`,
            userUuid, workspaceId,
          ]
        );
        created.push(r.rows[0]);
      } catch (e: any) {
        errors.push({ productId: line.productId, message: e.message });
      }
    }

    return NextResponse.json(
      { data: { received: created.length, errors, movements: created } },
      { status: errors.length > 0 ? 207 : 201 }
    );
  } catch (error: any) {
    console.error('Receive stock error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la réception' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
