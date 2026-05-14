#!/usr/bin/env tsx
/**
 * Test E2E du pont commande client négociée ↔ ordre de production.
 *
 * 1. Crée une commande client (draft) → submit → approve (= dans corbeille production)
 * 2. Crée un OP avec customerOrderId → vérifie le lien
 * 3. submit → approve → start l'OP
 *    → vérifie que customer_orders.status passe à 'in_production'
 *    → vérifie que customer_orders.production_order_id pointe sur l'OP
 * 4. Crée un batch (sinon complete refuse) → complete l'OP
 *    → vérifie que customer_orders.status passe à 'produced'
 * 5. Cleanup
 */
import { Pool } from 'pg';
import { CustomerOrderService } from '../../lib/modules/customer-orders/customer-order-service';
import { IngredientService } from '../../lib/modules/production/ingredient-service';
import { RecipeService } from '../../lib/modules/production/recipe-service';
import { ProductionOrderService } from '../../lib/modules/production/production-order-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const ko = (m: string) => { console.log(`  ✗ ${m}`); failed++; };
const eq = (label: string, actual: any, expected: any) => {
  if (String(actual) === String(expected)) ok(`${label} = ${actual}`);
  else ko(`${label}: attendu ${expected}, reçu ${actual}`);
};

const cleanup = {
  customerOrderId: null as string | null,
  productionOrderId: null as string | null,
  ingredientIds: [] as string[],
  recipeId: null as string | null,
};

async function main() {
  console.log('=== Test pont customer_order ↔ production_order ===\n');

  // Setup : récupère contexte
  const ws = await pool.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`);
  const wsUuid = ws.rows[0].id;
  const admin = await pool.query(
    `SELECT u.user_id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_id='admin' AND u.workspace_id=$1 LIMIT 1`,
    [wsUuid]
  );
  const adminId = admin.rows[0].user_id;
  const prod = await pool.query(`SELECT product_id FROM products WHERE workspace_id=$1 AND is_active LIMIT 1`, [wsUuid]);
  const productSlug = prod.rows[0].product_id;
  // (clients utilisent un schéma legacy où client_id est aussi UUID — on saute le client pour le test)

  // Setup : ingrédient + recette pour pouvoir créer un OP
  const ingSvc = new IngredientService();
  const recipeSvc = new RecipeService();
  const opSvc = new ProductionOrderService();
  const coSvc = new CustomerOrderService();

  const ing = await ingSvc.create({
    name: 'TEST-BRIDGE-Ing', code: 'TEST-BRIDGE-' + Date.now(),
    unit: 'g', unitCost: 100, minimumStock: 0, kind: 'raw', workspaceId: wsUuid,
  });
  cleanup.ingredientIds.push(ing.id!);
  await ingSvc.receive({ ingredientId: ing.IngredientId, qty: 1000, unitPrice: 100 });

  const recipe = await recipeSvc.create({
    name: 'TEST-BRIDGE-Recipe', productId: productSlug,
    outputQuantity: 100, outputUnit: 'pcs',
    lines: [{ ingredientId: ing.IngredientId, quantity: 10 }],
    workspaceId: wsUuid,
  });
  cleanup.recipeId = recipe.id!;

  // 1. Crée commande client + submit + approve
  console.log('[1] Crée customer_order → submit → approve');
  const co = await coSvc.create({
    workspaceId: wsUuid,
    clientName: 'TEST Bridge',
    totalAmount: 100000,
    requestedById: adminId,
    lines: [{ productId: productSlug, quantity: 100, unitPrice: 1000 }],
  });
  cleanup.customerOrderId = co.id;
  ok(`commande créée : ${co.order_id}`);

  await coSvc.submit(co.order_id);
  const co2 = await coSvc.approve(co.order_id, adminId);
  eq('co.status après approve', co2.status, 'approved');

  // 2. Crée OP avec customerOrderId
  console.log('\n[2] Crée OP avec customerOrderId');
  const op = await opSvc.create({
    recipeId: recipe.RecipeId,
    plannedQuantity: 100,
    plannedStartDate: new Date().toISOString().slice(0, 10),
    plannedEndDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    priority: 'normal',
    customerOrderId: co.order_id,  // ← passe le slug, le service résout en UUID
    workspaceId: wsUuid,
  });
  cleanup.productionOrderId = op.id!;
  // Vérifie que l'OP a bien le lien
  const opCheck = await pool.query(`SELECT customer_order_id FROM production_orders WHERE id = $1`, [op.id]);
  eq('op.customer_order_id (UUID lié)', opCheck.rows[0].customer_order_id, co.id);

  // 3. Submit + approve + start → propagation in_production
  console.log('\n[3] submit → approve → start (propagation in_production)');
  await opSvc.submit(op.id!, adminId);
  await opSvc.approve(op.id!, adminId);
  await opSvc.start(op.id!);

  const co3 = await pool.query(`SELECT status, production_order_id FROM customer_orders WHERE id = $1`, [co.id]);
  eq('après start OP, co.status', co3.rows[0].status, 'in_production');
  eq('après start OP, co.production_order_id', co3.rows[0].production_order_id, op.id);

  // 4. Crée batch + complete → propagation produced
  console.log('\n[4] consume + batch + complete (propagation produced)');
  await opSvc.consumeIngredients(op.id!, { ingredients: [{ ingredientId: ing.IngredientId, actualQuantity: 10 }] });
  await opSvc.createBatch(op.id!, { quantityProduced: 100, quantityDefective: 0 });
  await opSvc.complete(op.id!);

  const co4 = await pool.query(`SELECT status FROM customer_orders WHERE id = $1`, [co.id]);
  eq('après complete OP, co.status', co4.rows[0].status, 'produced');

  // 5. Cleanup
  console.log('\n[5] Cleanup');
  await pool.query(`UPDATE customer_orders SET production_order_id = NULL WHERE id = $1`, [co.id]);
  await pool.query(`DELETE FROM production_orders WHERE id = $1`, [op.id]);
  await pool.query(`DELETE FROM customer_order_lines WHERE customer_order_id = $1`, [co.id]);
  await pool.query(`DELETE FROM customer_orders WHERE id = $1`, [co.id]);
  await pool.query(`DELETE FROM recipes WHERE id = $1`, [recipe.id]);
  await pool.query(`DELETE FROM ingredient_receptions WHERE ingredient_id = $1`, [ing.id]);
  await pool.query(`DELETE FROM ingredients WHERE id = $1`, [ing.id]);
  ok('données de test supprimées');

  await pool.end();
  console.log(`\n=== ${failed === 0 ? '✅ ALL PASS' : `❌ ${failed} ASSERTION(S) FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('\n❌ Erreur fatale :', e.message);
  console.error(e.stack);
  try {
    if (cleanup.productionOrderId) {
      await pool.query(`UPDATE customer_orders SET production_order_id = NULL WHERE production_order_id = $1`, [cleanup.productionOrderId]);
      await pool.query(`DELETE FROM production_orders WHERE id = $1`, [cleanup.productionOrderId]);
    }
    if (cleanup.customerOrderId) {
      await pool.query(`DELETE FROM customer_order_lines WHERE customer_order_id = $1`, [cleanup.customerOrderId]);
      await pool.query(`DELETE FROM customer_orders WHERE id = $1`, [cleanup.customerOrderId]);
    }
    if (cleanup.recipeId) await pool.query(`DELETE FROM recipes WHERE id = $1`, [cleanup.recipeId]);
    for (const id of cleanup.ingredientIds) {
      await pool.query(`DELETE FROM ingredient_receptions WHERE ingredient_id = $1`, [id]);
      await pool.query(`DELETE FROM ingredients WHERE id = $1`, [id]);
    }
  } catch {}
  await pool.end();
  process.exit(1);
});
