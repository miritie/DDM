#!/usr/bin/env tsx
/**
 * Test E2E des transferts de stock 1→N.
 *
 *  1. Crée un transfert 1 source → 2 destinations (mix wh + outlet)
 *  2. Vérifie stock source décrémenté, lignes pending
 *  3. Confirme leg 1 en full → stock dest1 crédité, leg 1 = confirmed
 *  4. Confirme leg 2 en partiel → stock dest2 crédité de qty_received,
 *     leg 2 = adjusted, shortfall_decision = pending, statut entête =
 *     partially_received
 *  5. decideShortfall(leg 2, returned_to_source) → stock source recrédité
 *     de l'écart, statut entête = fully_received
 *  6. Cleanup
 */
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { StockTransferService } from '../../lib/modules/stock/stock-transfer-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const ko = (m: string) => { console.log(`  ✗ ${m}`); failed++; };
const eq = (l: string, a: any, e: any) => {
  if (String(a) === String(e)) ok(`${l} = ${a}`);
  else ko(`${l} : attendu ${e}, reçu ${a}`);
};

const cleanup = { stockItemIds: [] as string[], transferId: null as string | null };

async function main() {
  console.log('=== Test E2E stock transfers 1→N ===\n');

  const ws = (await pool.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`)).rows[0].id;
  const admin = (await pool.query(
    `SELECT u.user_id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_id='admin' AND u.workspace_id=$1 LIMIT 1`,
    [ws]
  )).rows[0];
  const product = (await pool.query(`SELECT id, product_id FROM products WHERE workspace_id=$1 AND is_active LIMIT 1`, [ws])).rows[0];
  const warehouses = (await pool.query(`SELECT id, warehouse_id, name FROM warehouses WHERE workspace_id=$1 LIMIT 2`, [ws])).rows;
  const outlet = (await pool.query(`SELECT id, code, name FROM outlets WHERE workspace_id=$1 LIMIT 1`, [ws])).rows[0];

  if (warehouses.length < 2) { console.log('Besoin d\'au moins 2 entrepôts en DB'); await pool.end(); return; }
  if (!outlet) { console.log('Besoin d\'au moins 1 outlet en DB'); await pool.end(); return; }

  const [sourceWh, destWh] = warehouses;

  // Repartir clean : supprime tout stock_items existant pour ce produit aux 2 wh + outlet
  await pool.query(`DELETE FROM stock_items WHERE product_id = $1 AND (warehouse_id = $2 OR warehouse_id = $3 OR outlet_id = $4)`,
    [product.id, sourceWh.id, destWh.id, outlet.id]);

  // Seed stock source : 100 unités
  const seedR = await pool.query(
    `INSERT INTO stock_items (stock_item_id, product_id, warehouse_id, quantity, minimum_stock, unit_cost, workspace_id)
     VALUES ($1, $2, $3, 100, 0, 1000, $4)
     ON CONFLICT DO NOTHING RETURNING id`,
    [`SI-${uuidv4().slice(0, 8)}`, product.id, sourceWh.id, ws]
  );
  if (seedR.rowCount! > 0) cleanup.stockItemIds.push(seedR.rows[0].id);
  // Récupère le stock initial source (au cas où ligne existait déjà)
  const before = await pool.query(
    `UPDATE stock_items SET quantity = 100 WHERE product_id = $1 AND warehouse_id = $2 AND workspace_id = $3 RETURNING quantity`,
    [product.id, sourceWh.id, ws]
  );
  console.log(`Setup : stock ${sourceWh.name} pour produit = ${before.rows[0].quantity}\n`);

  const svc = new StockTransferService();

  // [1] Créer le transfert
  console.log('[1] Crée transfert 1→2 (entrepôt + outlet)');
  const t = await svc.create({
    workspaceId: ws,
    initiatedById: admin.user_id,
    source: { warehouseId: sourceWh.warehouse_id },
    lines: [
      { productId: product.product_id, qtySent: 30, destination: { warehouseId: destWh.warehouse_id } },
      { productId: product.product_id, qtySent: 20, destination: { outletId: outlet.code } },
    ],
    notes: 'Test E2E transferts',
  });
  cleanup.transferId = t.id;
  eq('status entête', t.status, 'in_transit');
  eq('lignes créées', t.lines.length, 2);

  // [2] Stock source décrémenté de 50 (30+20)
  const afterCreate = await pool.query(`SELECT quantity FROM stock_items WHERE product_id=$1 AND warehouse_id=$2`, [product.id, sourceWh.id]);
  eq('stock source après émission', Number(afterCreate.rows[0].quantity), 50);

  // [3] Confirme leg 1 (entrepôt) en full
  console.log('\n[3] Confirme leg 1 en full');
  const leg1 = t.lines[0];
  const leg1After = await svc.confirmLeg(leg1.id, { qtyReceived: 30, confirmedById: admin.user_id });
  eq('leg 1 status', leg1After.leg_status, 'confirmed');

  const destStockA = await pool.query(`SELECT quantity FROM stock_items WHERE product_id=$1 AND warehouse_id=$2`, [product.id, destWh.id]);
  eq('stock destination 1 (entrepôt)', Number(destStockA.rows[0]?.quantity ?? 0), 30);

  // [4] Confirme leg 2 (outlet) en partiel (15 sur 20)
  console.log('\n[4] Confirme leg 2 en partiel (15/20)');
  const leg2 = t.lines[1];
  const leg2After = await svc.confirmLeg(leg2.id, { qtyReceived: 15, confirmedById: admin.user_id, adjustmentReason: 'Casse transport' });
  eq('leg 2 status', leg2After.leg_status, 'adjusted');
  eq('leg 2 shortfall_decision', leg2After.shortfall_decision, 'pending');

  const destStockB = await pool.query(`SELECT quantity FROM stock_items WHERE product_id=$1 AND outlet_id=$2`, [product.id, outlet.id]);
  eq('stock destination 2 (outlet)', Number(destStockB.rows[0]?.quantity ?? 0), 15);

  // Statut entête : partially_received (car leg 2 adjusted avec shortfall pending)
  const statusR = await pool.query(`SELECT status FROM stock_transfers WHERE id = $1`, [t.id]);
  eq('status entête après partiel', statusR.rows[0].status, 'partially_received');

  // [5] Decide shortfall en retour à la source
  console.log('\n[5] Décide retour à la source pour l\'écart (5)');
  await svc.decideShortfall(leg2.id, { decision: 'returned_to_source', decidedById: admin.user_id });

  const afterShortfall = await pool.query(`SELECT quantity FROM stock_items WHERE product_id=$1 AND warehouse_id=$2`, [product.id, sourceWh.id]);
  eq('stock source après retour écart', Number(afterShortfall.rows[0].quantity), 55);

  const statusFinal = await pool.query(`SELECT status, closed_at FROM stock_transfers WHERE id = $1`, [t.id]);
  eq('status entête final', statusFinal.rows[0].status, 'fully_received');
  ok(`closed_at renseigné : ${statusFinal.rows[0].closed_at != null}`);

  // [6] Cleanup
  console.log('\n[6] Cleanup');
  await pool.query(`DELETE FROM stock_transfer_lines WHERE transfer_id = $1`, [t.id]);
  await pool.query(`DELETE FROM stock_transfers WHERE id = $1`, [t.id]);
  // Réinitialise les stocks
  await pool.query(`DELETE FROM stock_items WHERE product_id = $1 AND warehouse_id = $2`, [product.id, destWh.id]);
  await pool.query(`DELETE FROM stock_items WHERE product_id = $1 AND outlet_id = $2`, [product.id, outlet.id]);
  await pool.query(`UPDATE stock_items SET quantity = 0 WHERE product_id = $1 AND warehouse_id = $2`, [product.id, sourceWh.id]);
  ok('données de test supprimées');

  await pool.end();
  console.log(`\n=== ${failed === 0 ? '✅ ALL PASS' : `❌ ${failed} ASSERTION(S) FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('❌', e.message);
  console.error(e.stack);
  try {
    if (cleanup.transferId) {
      await pool.query(`DELETE FROM stock_transfer_lines WHERE transfer_id = $1`, [cleanup.transferId]);
      await pool.query(`DELETE FROM stock_transfers WHERE id = $1`, [cleanup.transferId]);
    }
  } catch {}
  await pool.end();
  process.exit(1);
});
