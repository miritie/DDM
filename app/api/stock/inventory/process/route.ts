/**
 * POST /api/stock/inventory/process
 *
 * Applique un inventaire : pour chaque ajustement, met le stock à la quantité comptée
 * et trace un mouvement de stock de type 'adjustment'.
 *
 * Body :
 *   {
 *     warehouseId?: string,    // OU
 *     outletId?: string,       // exactement un des deux
 *     adjustments: Array<{
 *       productId: string,
 *       currentQuantity: number,
 *       countedQuantity: number,
 *       difference: number
 *     }>,
 *     notes?: string
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const user = await getCurrentUser();
    const body = await request.json();

    const { warehouseId, outletId, adjustments, notes } = body;

    if (!warehouseId && !outletId) {
      return NextResponse.json(
        { error: 'warehouseId ou outletId requis' },
        { status: 400 }
      );
    }
    if (warehouseId && outletId) {
      return NextResponse.json(
        { error: 'Un seul emplacement attendu (warehouseId OU outletId)' },
        { status: 400 }
      );
    }
    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      return NextResponse.json(
        { error: 'Aucun ajustement à enregistrer' },
        { status: 400 }
      );
    }

    // Résoudre l'UUID du vendeur courant (sales_person_id est un UUID FK vers users.id)
    const userRes = await db.query(
      `SELECT id FROM users WHERE user_id = $1 OR id::text = $1 LIMIT 1`,
      [user.userId]
    );
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }
    const userUuid = userRes.rows[0].id;

    // Résout warehouseId / outletId : accepte la PK UUID ou le slug VARCHAR
    let resolvedLocationId: string;
    if (warehouseId) {
      const wr = await db.query(
        `SELECT id FROM warehouses WHERE id::text = $1 OR warehouse_id = $1 LIMIT 1`,
        [warehouseId]
      );
      if (wr.rows.length === 0) {
        return NextResponse.json({ error: `Entrepôt introuvable : ${warehouseId}` }, { status: 404 });
      }
      resolvedLocationId = wr.rows[0].id;
    } else {
      const or = await db.query(
        `SELECT id FROM outlets WHERE id::text = $1 OR code = $1 LIMIT 1`,
        [outletId]
      );
      if (or.rows.length === 0) {
        return NextResponse.json({ error: `Point de vente introuvable : ${outletId}` }, { status: 404 });
      }
      resolvedLocationId = or.rows[0].id;
    }

    // Tout ou rien : la boucle entière est encapsulée dans une transaction.
    // Si une seule ligne échoue, on rollback toute l'inventaire pour ne pas
    // laisser de mises à jour partielles.
    const locationCol = warehouseId ? 'warehouse_id' : 'outlet_id';
    const movDestCol  = warehouseId ? 'destination_warehouse_id' : 'destination_outlet_id';
    const locationId = resolvedLocationId;

    let processed = 0;
    const errors: Array<{ productId: string; message: string }> = [];

    try {
      await db.transaction(async (client) => {
        for (const adj of adjustments) {
          // 0) Résoud productId : UUID ou slug `product_id` VARCHAR
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adj.productId);
          let productUuid: string;
          if (isUuid) {
            productUuid = adj.productId;
          } else {
            const pr = await client.query(
              `SELECT id FROM products WHERE product_id = $1 OR code = $1 LIMIT 1`,
              [adj.productId]
            );
            if (pr.rows.length === 0) {
              throw new Error(`Produit introuvable : ${adj.productId}`);
            }
            productUuid = pr.rows[0].id;
          }

          // 1) Trouve ou crée la ligne stock_items pour cet emplacement
          const existing = await client.query(
            `SELECT id, quantity, unit_cost FROM stock_items
             WHERE product_id = $1 AND ${locationCol} = $2
             LIMIT 1`,
            [productUuid, locationId]
          );

          const newQty = Number(adj.countedQuantity);
          let unitCost: number;

          if (existing.rows.length > 0) {
            unitCost = Number(existing.rows[0].unit_cost);
            const newTotalValue = newQty * unitCost;
            await client.query(
              `UPDATE stock_items
               SET quantity = $2, total_value = $3, updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [existing.rows[0].id, newQty, newTotalValue]
            );
          } else {
            // Coût : moyenne pondérée des autres lignes du produit, sinon 50% prix vente
            const avg = await client.query(
              `SELECT SUM(quantity * unit_cost) / NULLIF(SUM(quantity), 0) AS w
               FROM stock_items WHERE product_id = $1 AND unit_cost > 0 AND quantity > 0`,
              [productUuid]
            );
            if (avg.rows[0]?.w) {
              unitCost = Number(avg.rows[0].w);
            } else {
              const p = await client.query(`SELECT unit_price FROM products WHERE id = $1`, [productUuid]);
              unitCost = Number(p.rows[0]?.unit_price || 0) * 0.5;
            }
            // total_value pré-calculé côté JS pour éviter l'ambiguïté de type
            // PostgreSQL sur `$x * $y` (operator is not unique: unknown * unknown).
            const totalValue = newQty * unitCost;
            await client.query(
              `INSERT INTO stock_items
                (stock_item_id, product_id, ${locationCol}, quantity, minimum_stock,
                 unit_cost, total_value, workspace_id)
               VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
              [`STK-${uuidv4().slice(0, 8)}`, productUuid, locationId, newQty, unitCost, totalValue, workspaceId]
            );
          }

          // 2) Trace le mouvement (type 'adjustment')
          await client.query(
            `INSERT INTO stock_movements
              (movement_id, movement_number, type, product_id,
               ${movDestCol},
               quantity, unit_cost, total_cost, reason, status,
               processed_by_id, processed_at, workspace_id)
             VALUES ($1, $2, 'adjustment', $3, $4, $5, $6, $7, $8, 'validated', $9, CURRENT_TIMESTAMP, $10)`,
            [
              uuidv4(),
              `INV-${Date.now()}-${processed}`,
              productUuid,
              locationId,
              Math.abs(Number(adj.difference)),
              unitCost,
              Math.abs(Number(adj.difference)) * unitCost,
              notes || `Ajustement inventaire (compté ${adj.countedQuantity}, attendu ${adj.currentQuantity})`,
              userUuid,
              workspaceId,
            ]
          );

          processed++;
        }
      });
    } catch (e: any) {
      console.error('[inventory] rollback transaction:', e.message);
      return NextResponse.json(
        { error: `Inventaire annulé : ${e.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        processed,
        errorCount: errors.length,
        errors,
      },
    }, { status: errors.length > 0 ? 207 : 200 });
  } catch (error: any) {
    console.error('Inventory process error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
