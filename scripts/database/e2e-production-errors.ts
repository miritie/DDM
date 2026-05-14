#!/usr/bin/env tsx
/**
 * Test E2E des cas d'erreur métier — workflow doit refuser les raccourcis.
 *
 * 1. ProductionOrder.approve(draft) doit lever une erreur (exige submit avant)
 * 2. ProductionOrder.start(draft) doit lever (exige planned)
 * 3. ProductionOrder.start(in_progress quand stock MP insuffisant) doit lever
 * 4. ProductionOrder.consumeIngredients sur OP pas in_progress doit lever
 * 5. ProductionOrder.complete sans aucun batch doit lever
 * 6. PurchaseRequest.approve(draft) doit lever (exige submit avant)
 * 7. PurchaseRequest.approve(rejected) doit lever
 * 8. Ingredient.decreaseStock avec qty > current doit lever
 * 9. Ingredient.create avec code en doublon doit lever
 * 10. Recipe.create sans lignes doit lever
 */
import { Pool } from 'pg';
import { IngredientService } from '../../lib/modules/production/ingredient-service';
import { RecipeService } from '../../lib/modules/production/recipe-service';
import { ProductionOrderService } from '../../lib/modules/production/production-order-service';
import { PurchaseRequestService } from '../../lib/modules/production/purchase-request-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

let failed = 0;
const pass = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => { console.log(`  ✗ ${m}`); failed++; };

async function expectError(label: string, fn: () => Promise<any>, msgIncludes: string) {
  try {
    await fn();
    fail(`${label} — aucune erreur levée (attendu "${msgIncludes}")`);
  } catch (e: any) {
    if (!e.message || !e.message.toLowerCase().includes(msgIncludes.toLowerCase())) {
      fail(`${label} — message inattendu : "${e.message}" (attendu contient "${msgIncludes}")`);
    } else {
      pass(`${label} — refus correct : "${e.message.slice(0, 80)}…"`);
    }
  }
}

const cleanup = {
  ingredients: [] as string[],
  recipes: [] as string[],
  pr: [] as string[],
  expenses: [] as string[],
  op: [] as string[],
};

async function main() {
  console.log('=== Test E2E erreurs métier ===\n');

  const ws = await pool.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`);
  const wsUuid = ws.rows[0].id;
  const admin = await pool.query(
    `SELECT u.user_id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_id='admin' AND u.workspace_id=$1 LIMIT 1`,
    [wsUuid]
  );
  const adminId = admin.rows[0].user_id;
  const prod = await pool.query(`SELECT product_id FROM products WHERE workspace_id=$1 AND is_active LIMIT 1`, [wsUuid]);
  const productId = prod.rows[0].product_id;

  const ingSvc = new IngredientService();
  const recipeSvc = new RecipeService();
  const opSvc = new ProductionOrderService();
  const prSvc = new PurchaseRequestService();

  // Setup minimal : 1 ingrédient avec stock + 1 recette + 1 OP
  const ing = await ingSvc.create({
    name: 'TEST-ERR-Ing',
    code: 'TEST-ERR-' + Date.now(),
    unit: 'g', unitCost: 100, minimumStock: 10,
    kind: 'raw', workspaceId: wsUuid,
  });
  cleanup.ingredients.push(ing.id!);
  await ingSvc.receive({ ingredientId: ing.IngredientId, qty: 50, unitPrice: 100 });

  console.log('[1] Recipe.create sans lignes');
  await expectError('recipeSvc.create(lines=[])',
    () => recipeSvc.create({
      name: 'TEST-Empty', productId, outputQuantity: 100, outputUnit: 'pcs',
      lines: [], workspaceId: wsUuid,
    }),
    'au moins un'
  );

  console.log('\n[2] Ingredient.create code doublon');
  await expectError('ingSvc.create(code dup)',
    () => ingSvc.create({
      name: 'TEST-Dup', code: ing.Code,
      unit: 'g', unitCost: 100, kind: 'raw', workspaceId: wsUuid,
    }),
    'existe déjà'
  );

  console.log('\n[3] Ingredient.decreaseStock qty > current');
  await expectError('decreaseStock(1000 > 50 dispo)',
    () => ingSvc.decreaseStock(ing.IngredientId, 1000),
    'Stock insuffisant'
  );

  // Setup pour les tests OP
  const recipe = await recipeSvc.create({
    name: 'TEST-ERR-Recipe',
    productId,
    outputQuantity: 100, outputUnit: 'pcs',
    lines: [{ ingredientId: ing.IngredientId, quantity: 10 }],
    workspaceId: wsUuid,
  });
  cleanup.recipes.push(recipe.id!);

  const op = await opSvc.create({
    recipeId: recipe.RecipeId,
    plannedQuantity: 100,
    plannedStartDate: new Date().toISOString().slice(0, 10),
    plannedEndDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    priority: 'normal',
    workspaceId: wsUuid,
  });
  cleanup.op.push(op.id!);

  console.log('\n[4] ProductionOrder.approve(draft) doit lever (exige submit avant)');
  await expectError('opSvc.approve(draft)',
    () => opSvc.approve(op.id!, adminId),
    'soumis'
  );

  console.log('\n[5] ProductionOrder.start(draft) doit lever (exige planned)');
  await expectError('opSvc.start(draft)',
    () => opSvc.start(op.id!),
    'planifiés'
  );

  console.log('\n[6] ProductionOrder.consumeIngredients(draft) doit lever');
  await expectError('opSvc.consume(draft)',
    () => opSvc.consumeIngredients(op.id!, { ingredients: [{ ingredientId: ing.IngredientId, actualQuantity: 5 }] }),
    'en cours'
  );

  // Maintenant on submit + approve pour passer en planned
  await opSvc.submit(op.id!, adminId);
  await opSvc.approve(op.id!, adminId);

  console.log('\n[7] ProductionOrder.start avec stock insuffisant doit lever');
  // OP demande 10g ; mais on a 50g — on consomme tout sauf 5 pour créer pénurie
  await pool.query(`UPDATE ingredients SET current_stock = 5 WHERE id = $1`, [ing.id]);
  await expectError('opSvc.start avec 5g dispo / 10g requis',
    () => opSvc.start(op.id!),
    'Stock insuffisant'
  );
  // Restaure
  await pool.query(`UPDATE ingredients SET current_stock = 50 WHERE id = $1`, [ing.id]);

  // Lance pour de bon
  await opSvc.start(op.id!);

  console.log('\n[8] ProductionOrder.complete sans batch doit lever');
  await expectError('opSvc.complete(sans batch)',
    () => opSvc.complete(op.id!),
    'au moins un lot'
  );

  console.log('\n[9] PurchaseRequest.approve(draft) doit lever');
  const pr = await prSvc.create({
    workspaceId: wsUuid, requesterId: adminId,
    title: 'TEST-ERR-PR',
    lines: [{ ingredientId: ing.IngredientId, qtyRequested: 100, estimatedUnitPrice: 100 }],
  });
  cleanup.pr.push(pr.id);
  await expectError('prSvc.approve(draft)',
    () => prSvc.approve(pr.id, adminId),
    'soumise'
  );

  console.log('\n[10] PurchaseRequest.approve après reject doit lever');
  await prSvc.submit(pr.id);
  await prSvc.reject(pr.id, 'Test rejet');
  await expectError('prSvc.approve(rejected)',
    () => prSvc.approve(pr.id, adminId),
    'soumise'
  );

  // Cleanup
  console.log('\n[Cleanup]');
  for (const id of cleanup.expenses) await pool.query(`DELETE FROM expenses WHERE id = $1`, [id]);
  for (const id of cleanup.op) await pool.query(`DELETE FROM production_orders WHERE id = $1`, [id]);
  for (const id of cleanup.pr) {
    await pool.query(`DELETE FROM expense_approval_steps WHERE expense_request_id = $1`, [id]);
    await pool.query(`DELETE FROM purchase_request_lines WHERE expense_request_id = $1`, [id]);
    await pool.query(`DELETE FROM expense_requests WHERE id = $1`, [id]);
  }
  for (const id of cleanup.recipes) await pool.query(`DELETE FROM recipes WHERE id = $1`, [id]);
  for (const id of cleanup.ingredients) {
    await pool.query(`DELETE FROM ingredient_receptions WHERE ingredient_id = $1`, [id]);
    await pool.query(`DELETE FROM ingredients WHERE id = $1`, [id]);
  }
  pass('Cleanup effectué');

  await pool.end();
  console.log(`\n=== ${failed === 0 ? '✅ ALL PASS' : `❌ ${failed} ASSERTION(S) FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('Erreur fatale :', e);
  try {
    for (const id of cleanup.expenses) await pool.query(`DELETE FROM expenses WHERE id = $1`, [id]);
    for (const id of cleanup.op) await pool.query(`DELETE FROM production_orders WHERE id = $1`, [id]);
    for (const id of cleanup.pr) {
      await pool.query(`DELETE FROM expense_approval_steps WHERE expense_request_id = $1`, [id]);
      await pool.query(`DELETE FROM purchase_request_lines WHERE expense_request_id = $1`, [id]);
      await pool.query(`DELETE FROM expense_requests WHERE id = $1`, [id]);
    }
    for (const id of cleanup.recipes) await pool.query(`DELETE FROM recipes WHERE id = $1`, [id]);
    for (const id of cleanup.ingredients) {
      await pool.query(`DELETE FROM ingredient_receptions WHERE ingredient_id = $1`, [id]);
      await pool.query(`DELETE FROM ingredients WHERE id = $1`, [id]);
    }
  } catch {}
  await pool.end();
  process.exit(1);
});
