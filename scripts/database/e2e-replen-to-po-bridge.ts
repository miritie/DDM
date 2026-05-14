#!/usr/bin/env tsx
/**
 * Test E2E du pont réappro stand ↔ OP.
 *
 *   1. Crée un réappro draft (manuellement via SQL puisque ReplenishmentService
 *      n'est pas câblé ici en tests) → submit → approve
 *   2. Crée un OP avec replenishmentId
 *   3. Submit OP → approve OP → start OP
 *      → vérifie que stand_replenishment_orders.status passe à 'in_production'
 *   4. Crée batch + complete l'OP
 *      → vérifie que stand_replenishment_orders.status passe à 'produced'
 *   5. Cleanup
 */
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { IngredientService } from '../../lib/modules/production/ingredient-service';
import { RecipeService } from '../../lib/modules/production/recipe-service';
import { ProductionOrderService } from '../../lib/modules/production/production-order-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const ko = (m: string) => { console.log(`  ✗ ${m}`); failed++; };
const eq = (l: string, a: any, e: any) => { if (String(a) === String(e)) ok(`${l} = ${a}`); else ko(`${l}: attendu ${e}, reçu ${a}`); };

const cleanup = {
  replenishmentId: null as string | null,
  productionOrderId: null as string | null,
  ingredientId: null as string | null,
  recipeId: null as string | null,
};

async function main() {
  console.log('=== Test pont stand_replenishment_orders ↔ production_orders ===\n');

  const ws = (await pool.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`)).rows[0].id;
  const admin = (await pool.query(
    `SELECT u.id, u.user_id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_id='admin' AND u.workspace_id=$1 LIMIT 1`,
    [ws]
  )).rows[0];
  const product = (await pool.query(
    `SELECT id, product_id FROM products WHERE workspace_id=$1 AND is_active LIMIT 1`,
    [ws]
  )).rows[0];

  const ingSvc = new IngredientService();
  const recSvc = new RecipeService();
  const opSvc = new ProductionOrderService();

  // Setup ingrédient + recette
  const ing = await ingSvc.create({
    name: 'TEST-RP-Ing', code: 'TEST-RP-' + Date.now(),
    unit: 'g', unitCost: 100, kind: 'raw', workspaceId: ws,
  });
  cleanup.ingredientId = ing.id!;
  await ingSvc.receive({ ingredientId: ing.IngredientId, qty: 1000, unitPrice: 100 });

  const recipe = await recSvc.create({
    name: 'TEST-RP-Recipe', productId: product.product_id,
    outputQuantity: 100, outputUnit: 'pcs',
    lines: [{ ingredientId: ing.IngredientId, quantity: 10 }],
    workspaceId: ws,
  });
  cleanup.recipeId = recipe.id!;

  // [1] Crée un réappro en SQL direct
  console.log('[1] Crée réappro draft → submit → approve');
  const repSlug = `APR-TEST-${Date.now()}`;
  const repR = await pool.query(
    `INSERT INTO stand_replenishment_orders
       (replenishment_id, replenishment_number, status, total_value_estimate,
        notes, requested_by_id, workspace_id)
     VALUES ($1, $2, 'approved', 100000, 'Test E2E', $3, $4)
     RETURNING id`,
    [repSlug, repSlug, admin.id, ws]
  );
  cleanup.replenishmentId = repR.rows[0].id;
  await pool.query(
    `INSERT INTO stand_replenishment_lines (replenishment_id, product_id, product_name, quantity_requested)
     VALUES ($1, $2, 'TEST Product', 100)`,
    [repR.rows[0].id, product.id]
  );
  ok(`réappro ${repSlug} en status='approved'`);

  // [2] Crée OP avec replenishmentId
  console.log('\n[2] Crée OP avec replenishmentId');
  const op = await opSvc.create({
    recipeId: recipe.RecipeId,
    plannedQuantity: 100,
    plannedStartDate: new Date().toISOString().slice(0, 10),
    plannedEndDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    priority: 'normal',
    replenishmentId: repSlug,  // ← slug, le service résout
    workspaceId: ws,
  });
  cleanup.productionOrderId = op.id!;
  const opCheck = await pool.query(`SELECT replenishment_id FROM production_orders WHERE id = $1`, [op.id]);
  eq('op.replenishment_id (UUID lié)', opCheck.rows[0].replenishment_id, repR.rows[0].id);

  // [3] submit → approve → start → propagation
  console.log('\n[3] submit → approve → start (propagation in_production)');
  await opSvc.submit(op.id!, admin.user_id);
  await opSvc.approve(op.id!, admin.user_id);
  await opSvc.start(op.id!);

  const rep3 = await pool.query(
    `SELECT status, production_order_id FROM stand_replenishment_orders WHERE id = $1`,
    [repR.rows[0].id]
  );
  eq('après start OP, replenishment.status', rep3.rows[0].status, 'in_production');
  eq('après start OP, replenishment.production_order_id', rep3.rows[0].production_order_id, op.id);

  // [4] consume + batch + complete → propagation produced
  console.log('\n[4] consume + batch + complete (propagation produced)');
  await opSvc.consumeIngredients(op.id!, { ingredients: [{ ingredientId: ing.IngredientId, actualQuantity: 10 }] });
  await opSvc.createBatch(op.id!, { quantityProduced: 100, quantityDefective: 0 });
  await opSvc.complete(op.id!);

  const rep4 = await pool.query(`SELECT status FROM stand_replenishment_orders WHERE id = $1`, [repR.rows[0].id]);
  eq('après complete OP, replenishment.status', rep4.rows[0].status, 'produced');

  // [5] Cleanup
  console.log('\n[5] Cleanup');
  await pool.query(`UPDATE stand_replenishment_orders SET production_order_id = NULL WHERE id = $1`, [repR.rows[0].id]);
  await pool.query(`DELETE FROM production_orders WHERE id = $1`, [op.id]);
  await pool.query(`DELETE FROM stand_replenishment_lines WHERE replenishment_id = $1`, [repR.rows[0].id]);
  await pool.query(`DELETE FROM stand_replenishment_orders WHERE id = $1`, [repR.rows[0].id]);
  await pool.query(`DELETE FROM recipes WHERE id = $1`, [recipe.id]);
  await pool.query(`DELETE FROM ingredient_receptions WHERE ingredient_id = $1`, [ing.id]);
  await pool.query(`DELETE FROM ingredients WHERE id = $1`, [ing.id]);
  ok('données de test supprimées');

  await pool.end();
  console.log(`\n=== ${failed === 0 ? '✅ ALL PASS' : `❌ ${failed} ASSERTION(S) FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('❌', e.message);
  try {
    if (cleanup.productionOrderId) {
      await pool.query(`UPDATE stand_replenishment_orders SET production_order_id = NULL WHERE production_order_id = $1`, [cleanup.productionOrderId]);
      await pool.query(`DELETE FROM production_orders WHERE id = $1`, [cleanup.productionOrderId]);
    }
    if (cleanup.replenishmentId) {
      await pool.query(`DELETE FROM stand_replenishment_lines WHERE replenishment_id = $1`, [cleanup.replenishmentId]);
      await pool.query(`DELETE FROM stand_replenishment_orders WHERE id = $1`, [cleanup.replenishmentId]);
    }
    if (cleanup.recipeId) await pool.query(`DELETE FROM recipes WHERE id = $1`, [cleanup.recipeId]);
    if (cleanup.ingredientId) {
      await pool.query(`DELETE FROM ingredient_receptions WHERE ingredient_id = $1`, [cleanup.ingredientId]);
      await pool.query(`DELETE FROM ingredients WHERE id = $1`, [cleanup.ingredientId]);
    }
  } catch {}
  await pool.end();
  process.exit(1);
});
