#!/usr/bin/env tsx
/**
 * Test E2E v2 : recall émetteur + filtrage par destinations dont l'user
 * est manager.
 *
 * Setup :
 *   - User A = manager du destWh A
 *   - User B = manager du destWh B
 *   - Émetteur (admin) crée 1 transfert source → A + B (2 lignes)
 *
 * 1. countPendingLegsForUser(A) = 1 (juste sa ligne)
 * 2. countPendingLegsForUser(B) = 1
 * 3. countPendingLegs() = 2 (vue globale)
 * 4. listIncomingForUser(A) → 1 transfert avec sa ligne pending
 * 5. recallLeg(leg A) par l'émetteur → leg A passe à 'recalled', stock source recrédité
 * 6. countPendingLegsForUser(A) = 0
 * 7. cleanup
 */
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { StockTransferService } from '../../lib/modules/stock/stock-transfer-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const ko = (m: string) => { console.log(`  ✗ ${m}`); failed++; };
const eq = (l: string, a: any, e: any) => {
  if (String(a) === String(e)) ok(`${l} = ${a}`); else ko(`${l}: attendu ${e}, reçu ${a}`);
};

const cleanup = { transferId: null as string | null, restoreManagers: [] as Array<{ id: string; manager_id: string | null }> };

async function main() {
  console.log('=== Test E2E stock transfers v2 (recall + filtrage) ===\n');

  const ws = (await pool.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`)).rows[0].id;
  const admin = (await pool.query(
    `SELECT u.id, u.user_id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_id='admin' AND u.workspace_id=$1 LIMIT 1`,
    [ws]
  )).rows[0];
  const product = (await pool.query(`SELECT id, product_id FROM products WHERE workspace_id=$1 AND is_active LIMIT 1`, [ws])).rows[0];
  const warehouses = (await pool.query(`SELECT id, warehouse_id, name, manager_id FROM warehouses WHERE workspace_id=$1 LIMIT 2`, [ws])).rows;
  const outlets = (await pool.query(`SELECT id, code, name, manager_id FROM outlets WHERE workspace_id=$1 LIMIT 2`, [ws])).rows;
  if (warehouses.length < 2 || outlets.length < 2) {
    console.log(`Besoin de ≥2 warehouses (${warehouses.length}) et ≥2 outlets (${outlets.length})`); await pool.end(); return;
  }
  // 1 source = warehouse, destA = autre warehouse, destB = outlet
  const sourceWh = warehouses[0];
  const destA = warehouses[1];
  const destB_outlet = outlets[0];
  const destB = { id: destB_outlet.id, name: destB_outlet.name, manager_id: destB_outlet.manager_id, code: destB_outlet.code, isOutlet: true };

  // Choisis 2 users distincts pour A et B (différents de admin)
  const users = (await pool.query(
    `SELECT u.id, u.user_id, u.full_name FROM users u
     WHERE u.workspace_id = $1 AND u.id != $2 AND u.is_active = true
     LIMIT 2`,
    [ws, admin.id]
  )).rows;
  if (users.length < 2) {
    console.log(`Besoin de 2 users non-admin (${users.length} dispo). Test partiel sur countPendingLegs global.`);
  }
  const userA = users[0];
  const userB = users[1] ?? users[0]; // fallback : un seul user

  // Pose les manager_id (en sauvant l'état initial pour restaurer)
  cleanup.restoreManagers.push({ id: destA.id, manager_id: destA.manager_id });
  await pool.query(`UPDATE warehouses SET manager_id = $2 WHERE id = $1`, [destA.id, userA.id]);
  // destB est un outlet — sauvegarde manager_id et update
  const destBManagerBefore = destB.manager_id;
  await pool.query(`UPDATE outlets SET manager_id = $2 WHERE id = $1`, [destB.id, userB?.id ?? userA.id]);
  console.log(`Setup : ${destA.name} (wh) = ${userA.full_name}, ${destB.name} (outlet) = ${userB?.full_name ?? userA.full_name}\n`);

  // Reset stock
  await pool.query(`DELETE FROM stock_items WHERE product_id = $1 AND (warehouse_id IN ($2, $3) OR outlet_id = $4)`,
    [product.id, sourceWh.id, destA.id, destB.id]);
  await pool.query(
    `INSERT INTO stock_items (stock_item_id, product_id, warehouse_id, quantity, minimum_stock, unit_cost, workspace_id)
     VALUES ($1, $2, $3, 100, 0, 1000, $4)`,
    [`SI-${uuidv4().slice(0, 8)}`, product.id, sourceWh.id, ws]
  );

  const svc = new StockTransferService();

  // [1] Crée transfert 1→2
  console.log('[1] Crée transfert source→A + source→B');
  const t = await svc.create({
    workspaceId: ws,
    initiatedById: admin.user_id,
    source: { warehouseId: sourceWh.warehouse_id },
    lines: [
      { productId: product.product_id, qtySent: 30, destination: { warehouseId: destA.warehouse_id } },
      { productId: product.product_id, qtySent: 20, destination: { outletId: destB.code } },
    ],
  });
  cleanup.transferId = t.id;
  ok(`transfert ${t.transfer_number} créé, 2 lignes pending`);

  // [2] countPendingLegs global = 2
  console.log('\n[2] Vérification compteurs');
  const globalCount = await svc.countPendingLegs(ws);
  // Note : on compte ≥ 2 (peut y avoir d'autres pendants dans le workspace)
  if (globalCount >= 2) ok(`countPendingLegs global = ${globalCount} (au moins nos 2)`);
  else ko(`countPendingLegs global = ${globalCount}, attendu ≥ 2`);

  const countA = await svc.countPendingLegsForUser(ws, userA.user_id);
  // Si A = B (1 seul user), countA = 2. Sinon = 1.
  if (userA.id === (userB?.id ?? userA.id)) {
    eq('countPendingLegsForUser(A=B, 1 user)', countA, 2);
  } else {
    eq('countPendingLegsForUser(A) (que sa destination)', countA, 1);
  }

  // [3] listIncomingForUser(A) renvoie 1 transfert (pas plus, c'est sa destination)
  const inA = await svc.listIncomingForUser(ws, userA.user_id);
  const inAFiltered = inA.filter((x: any) => x.id === t.id);
  eq('listIncomingForUser(A) inclut notre transfert', inAFiltered.length, 1);

  // [4] recallLeg(legA) par l'émetteur
  console.log('\n[4] L\'émetteur rappelle la ligne destination A');
  const legA = t.lines.find((l: any) => l.destination_warehouse_id === destA.id);
  if (!legA) { ko('legA introuvable dans t.lines'); }
  else {
    const stockSrcBefore = (await pool.query(`SELECT quantity FROM stock_items WHERE product_id=$1 AND warehouse_id=$2`, [product.id, sourceWh.id])).rows[0].quantity;
    const recalled = await svc.recallLeg(legA.id, { recalledById: admin.user_id, reason: 'test E2E v2' });
    eq('legA status après recall', recalled.leg_status, 'recalled');

    const stockSrcAfter = (await pool.query(`SELECT quantity FROM stock_items WHERE product_id=$1 AND warehouse_id=$2`, [product.id, sourceWh.id])).rows[0].quantity;
    eq('stock source recrédité de la qty rappelée', Number(stockSrcAfter) - Number(stockSrcBefore), 30);

    // [5] countPendingLegsForUser(A) doit avoir baissé de 1
    const countAAfter = await svc.countPendingLegsForUser(ws, userA.user_id);
    eq('countPendingLegsForUser(A) après recall', countAAfter, countA - 1);
  }

  // [6] Cleanup
  console.log('\n[6] Cleanup');
  await pool.query(`DELETE FROM stock_transfer_lines WHERE transfer_id = $1`, [t.id]);
  await pool.query(`DELETE FROM stock_transfers WHERE id = $1`, [t.id]);
  // Restore les manager_id originaux
  for (const r of cleanup.restoreManagers) {
    await pool.query(`UPDATE warehouses SET manager_id = $2 WHERE id = $1`, [r.id, r.manager_id]);
  }
  await pool.query(`UPDATE outlets SET manager_id = $2 WHERE id = $1`, [destB.id, destBManagerBefore]);
  // Reset les stocks créés
  await pool.query(`DELETE FROM stock_items WHERE product_id = $1 AND (warehouse_id IN ($2,$3) OR outlet_id = $4)`,
    [product.id, sourceWh.id, destA.id, destB.id]);
  ok('données de test supprimées + manager_ids restaurés');

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
    for (const r of cleanup.restoreManagers) {
      await pool.query(`UPDATE warehouses SET manager_id = $2 WHERE id = $1`, [r.id, r.manager_id]);
    }
  } catch {}
  await pool.end();
  process.exit(1);
});
