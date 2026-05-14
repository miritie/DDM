#!/usr/bin/env tsx
/**
 * Test E2E du workflow production-MP-achats.
 *
 * 1. Crée 2 ingrédients (raw) + 1 recette qui les utilise
 * 2. Réception directe MP → vérifie PMP recalculé
 * 3. PurchaseRequest (2 lignes) → submit → approve → expense auto créée
 * 4. Receive lignes PR → stock incrémenté + PMP recalculé + traces
 * 5. OP créé à partir de la recette → submit → approve → start
 * 6. Consume ingredients → décrément stock + variance
 * 7. CreateBatch → stock produit fini crédité
 * 8. Complete OP
 * 9. Cleanup intégral
 *
 * Affiche en cours : ✓ pour chaque assertion qui passe, ✗ + détail sinon.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

import { Pool } from 'pg';
import { IngredientService } from '../../lib/modules/production/ingredient-service';
import { RecipeService } from '../../lib/modules/production/recipe-service';
import { ProductionOrderService } from '../../lib/modules/production/production-order-service';
import { PurchaseRequestService } from '../../lib/modules/production/purchase-request-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const ko = (m: string) => { console.log(`  ✗ ${m}`); failed++; };
const step = (n: number, m: string) => console.log(`\n[${n}] ${m}`);
const eq = (label: string, actual: any, expected: any) => {
  const a = typeof actual === 'number' ? Number(actual).toFixed(4) : String(actual);
  const e = typeof expected === 'number' ? Number(expected).toFixed(4) : String(expected);
  if (a === e) ok(`${label} = ${a}`);
  else ko(`${label}: attendu ${e}, reçu ${a}`);
};

// Identifiants de cleanup
const cleanup = {
  ingredients: [] as string[],
  recipes: [] as string[],
  purchaseRequests: [] as string[],
  productionOrders: [] as string[],
  expenseIds: [] as string[],
};

async function main() {
  console.log('=== Test E2E production workflow ===\n');

  // Setup : récupère workspace + user admin + un product
  const ws = await pool.query(`SELECT id, workspace_id FROM workspaces ORDER BY created_at LIMIT 1`);
  if (ws.rowCount === 0) { console.error('Aucun workspace.'); process.exit(1); }
  const workspaceUuid = ws.rows[0].id;
  console.log(`Workspace : ${ws.rows[0].workspace_id}`);

  const admin = await pool.query(
    `SELECT u.id, u.user_id FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.role_id = 'admin' AND u.workspace_id = $1 LIMIT 1`,
    [workspaceUuid]
  );
  if (admin.rowCount === 0) { console.error('Aucun admin.'); process.exit(1); }
  const adminUserId = admin.rows[0].user_id;
  console.log(`Admin user : ${adminUserId}`);

  const mgrProd = await pool.query(
    `SELECT u.id, u.user_id FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.role_id = 'manager_production' AND u.workspace_id = $1 LIMIT 1`,
    [workspaceUuid]
  );
  const mgrProdUserId = mgrProd.rows[0]?.user_id ?? adminUserId;
  console.log(`Manager prod : ${mgrProdUserId}`);

  const prod = await pool.query(`SELECT id, product_id FROM products WHERE workspace_id = $1 AND is_active LIMIT 1`, [workspaceUuid]);
  if (prod.rowCount === 0) { console.error('Aucun produit.'); process.exit(1); }
  const productIdSlug = prod.rows[0].product_id;
  console.log(`Produit cible : ${productIdSlug}`);

  const ingService = new IngredientService();
  const recipeService = new RecipeService();
  const opService = new ProductionOrderService();
  const prService = new PurchaseRequestService();

  // -----------------------------------------------------------------
  step(1, 'Création de 2 matières premières (raw)');
  const ing1 = await ingService.create({
    name: 'TEST-Gingembre E2E',
    code: 'TEST-GINGEMBRE-' + Date.now(),
    unit: 'g',
    unitCost: 100, // PMP initial
    minimumStock: 500,
    kind: 'raw',
    workspaceId: workspaceUuid,
  });
  cleanup.ingredients.push(ing1.id!);
  eq('ing1.Kind', ing1.Kind, 'raw');
  eq('ing1.UnitCost', Number(ing1.UnitCost), 100);
  eq('ing1.CurrentStock', Number(ing1.CurrentStock), 0);

  const ing2 = await ingService.create({
    name: 'TEST-Miel E2E',
    code: 'TEST-MIEL-' + Date.now(),
    unit: 'g',
    unitCost: 50,
    minimumStock: 100,
    kind: 'raw',
    workspaceId: workspaceUuid,
  });
  cleanup.ingredients.push(ing2.id!);
  ok(`Ingrédients créés : ${ing1.Code} et ${ing2.Code}`);

  // -----------------------------------------------------------------
  step(2, 'Création d\'une recette TEST (produit fini = ' + productIdSlug + ')');
  const recipe = await recipeService.create({
    name: 'TEST-Recette E2E',
    productId: productIdSlug,
    outputQuantity: 100,
    outputUnit: 'pcs',
    yieldRate: 95,
    estimatedDuration: 60,
    lines: [
      { ingredientId: ing1.IngredientId, quantity: 10, unit: 'g' },
      { ingredientId: ing2.IngredientId, quantity: 5, unit: 'g' },
    ],
    workspaceId: workspaceUuid,
  });
  cleanup.recipes.push(recipe.id!);
  eq('recipe.Version', recipe.Version, 1);
  eq('recipe.Lines.length', recipe.Lines.length, 2);

  // Cost calcul live : 10*100 + 5*50 = 1250 pour 100 pcs → 12.5/pcs
  const cost = await recipeService.calculateCost(recipe.RecipeId);
  eq('cost.totalCost', cost.totalCost, 1250);
  eq('cost.costPerUnit', cost.costPerUnit, 12.5);

  // -----------------------------------------------------------------
  step(3, 'Réception directe MP — test du PMP pondéré');
  // ing1 stock=0, PMP=100. On reçoit 1000g à 80 → nouveau PMP = (0*100 + 1000*80)/(0+1000) = 80
  await ingService.receive({ ingredientId: ing1.IngredientId, qty: 1000, unitPrice: 80 });
  let cur = await ingService.getById(ing1.IngredientId);
  eq('ing1.CurrentStock après 1000', Number(cur!.CurrentStock), 1000);
  eq('ing1.UnitCost (PMP) après 1000@80', Number(cur!.UnitCost), 80);

  // Re-réception 500g à 200 → PMP = (1000*80 + 500*200) / 1500 = (80000 + 100000) / 1500 = 120
  await ingService.receive({ ingredientId: ing1.IngredientId, qty: 500, unitPrice: 200 });
  cur = await ingService.getById(ing1.IngredientId);
  eq('ing1.CurrentStock après +500', Number(cur!.CurrentStock), 1500);
  eq('ing1.UnitCost (PMP) après 500@200', Number(cur!.UnitCost), 120);

  // Trace dans ingredient_receptions
  const tr = await pool.query(
    `SELECT pmp_before, pmp_after, stock_after FROM ingredient_receptions WHERE ingredient_id = $1 ORDER BY received_at`,
    [ing1.id]
  );
  eq('traces ingredient_receptions count', tr.rowCount, 2);
  eq('trace[1].pmp_after', Number(tr.rows[1].pmp_after), 120);

  // Stock initial ing2 pour les besoins de l'OP
  await ingService.receive({ ingredientId: ing2.IngredientId, qty: 500, unitPrice: 60 });
  cur = await ingService.getById(ing2.IngredientId);
  eq('ing2.CurrentStock', Number(cur!.CurrentStock), 500);
  eq('ing2.UnitCost (PMP) après 500@60', Number(cur!.UnitCost), 60);

  // -----------------------------------------------------------------
  step(4, 'PurchaseRequest avec 2 lignes — workflow draft→submitted→approved');
  const pr = await prService.create({
    workspaceId: workspaceUuid,
    requesterId: mgrProdUserId,
    title: 'TEST-PR E2E',
    description: 'Sollicitation test E2E',
    lines: [
      { ingredientId: ing1.IngredientId, qtyRequested: 2000, estimatedUnitPrice: 150 },
      { ingredientId: ing2.IngredientId, qtyRequested: 200, estimatedUnitPrice: 70 },
    ],
  });
  cleanup.purchaseRequests.push(pr.id);
  eq('pr.Status', pr.Status, 'draft');
  eq('pr.Amount (calculé)', Number(pr.Amount), 2000 * 150 + 200 * 70);
  eq('pr.Lines.length', pr.Lines.length, 2);

  const pr2 = await prService.submit(pr.id);
  eq('après submit, pr.Status', pr2.Status, 'submitted');

  const approveRes = await prService.approve(pr.id, adminUserId);
  eq('après approve, pr.Status', approveRes.purchaseRequest.Status, 'approved');
  cleanup.expenseIds.push(approveRes.expenseId);

  // Vérifie expense auto-créée
  const exp = await pool.query(`SELECT amount, status, expense_request_id FROM expenses WHERE id = $1`, [approveRes.expenseId]);
  eq('expense auto.status', exp.rows[0].status, 'approved');
  eq('expense auto.amount = PR.Amount', Number(exp.rows[0].amount), Number(pr.Amount));

  // -----------------------------------------------------------------
  step(5, 'Réception des lignes du PR');
  const pr3 = await prService.getById(pr.id);
  const line1 = pr3.Lines.find((l: any) => l.IngredientId === ing1.id);
  const line2 = pr3.Lines.find((l: any) => l.IngredientId === ing2.id);

  // Reception ligne1 (2000g à 150 reçus pour de vrai)
  const stockBeforeIng1 = Number((await ingService.getById(ing1.IngredientId))!.CurrentStock);
  const pmpBeforeIng1 = Number((await ingService.getById(ing1.IngredientId))!.UnitCost);
  await prService.receiveLine({
    purchaseRequestLineId: line1.PurchaseRequestLineId,
    qty: 2000,
    unitPrice: 150,
    receivedById: mgrProdUserId,
  });
  const ing1After = await ingService.getById(ing1.IngredientId);
  eq('ing1.CurrentStock après réception PR', Number(ing1After!.CurrentStock), stockBeforeIng1 + 2000);
  // PMP attendu = (1500*120 + 2000*150)/3500 = 137.1428571...
  // → tronqué à 137.14 par DECIMAL(15,2) ; tolérance 2 décimales suffisante pour XOF.
  const expectedPMP = (stockBeforeIng1 * pmpBeforeIng1 + 2000 * 150) / (stockBeforeIng1 + 2000);
  eq('ing1.UnitCost (PMP) après réception PR (2dp DB)', Number(ing1After!.UnitCost).toFixed(2), expectedPMP.toFixed(2));

  // qty_received et actual_total sur la ligne
  const lineCheck = await pool.query(`SELECT qty_received, actual_total FROM purchase_request_lines WHERE id = $1`, [line1.id]);
  eq('line1.qty_received', Number(lineCheck.rows[0].qty_received), 2000);
  eq('line1.actual_total', Number(lineCheck.rows[0].actual_total), 2000 * 150);

  // Reception ligne2 (partielle : 100g sur 200g demandés)
  await prService.receiveLine({
    purchaseRequestLineId: line2.PurchaseRequestLineId,
    qty: 100, unitPrice: 70,
    receivedById: mgrProdUserId,
  });
  const status5 = await prService.getReceptionStatus(pr.id);
  eq('reception status fullyReceived (partiel)', status5.fullyReceived, false);
  eq('reception status linesReceived', status5.linesReceived, 1);

  // -----------------------------------------------------------------
  step(6, 'OP créé sur la recette — workflow draft→submitted→planned→in_progress→completed');
  const op = await opService.create({
    recipeId: recipe.RecipeId,
    plannedQuantity: 100, // = recipe.OutputQuantity → scaleFactor=1 → cons planifiées = 10g ing1, 5g ing2
    plannedStartDate: new Date().toISOString().slice(0, 10),
    plannedEndDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    priority: 'normal',
    workspaceId: workspaceUuid,
  });
  cleanup.productionOrders.push(op.id!);
  eq('op.Status', op.Status, 'draft');
  eq('op.RecipeVersion', op.RecipeVersion, recipe.Version);
  eq('op.IngredientConsumptions.length', op.IngredientConsumptions.length, 2);
  const planIng1 = op.IngredientConsumptions.find((c) => c.IngredientId === ing1.id);
  eq('op.cons[ing1].PlannedQuantity', Number(planIng1!.PlannedQuantity), 10);

  // Submit
  const op2 = await opService.submit(op.id!, mgrProdUserId);
  eq('après submit, op.Status', op2.Status, 'submitted');
  if (!op2.SubmittedAt) ko('SubmittedAt non renseigné');
  else ok(`op.SubmittedAt = ${new Date(op2.SubmittedAt).toISOString()}`);

  // Approve (forçons une nouvelle lecture du status pour confirmer)
  const op3 = await opService.approve(op.id!, adminUserId);
  eq('après approve, op.Status', op3.Status, 'planned');
  if (!op3.ApprovedAt) ko('ApprovedAt non renseigné');
  else ok(`op.ApprovedAt = ${new Date(op3.ApprovedAt).toISOString()}`);

  // Start (vérifie stock suffisant)
  const op4 = await opService.start(op.id!);
  eq('après start, op.Status', op4.Status, 'in_progress');

  // -----------------------------------------------------------------
  step(7, 'Consommation ingrédients : 12g ing1 (+20%), 4g ing2 (-20%)');
  const stockIng1Before = Number((await ingService.getById(ing1.IngredientId))!.CurrentStock);
  const stockIng2Before = Number((await ingService.getById(ing2.IngredientId))!.CurrentStock);

  const op5 = await opService.consumeIngredients(op.id!, {
    ingredients: [
      { ingredientId: ing1.IngredientId, actualQuantity: 12 },
      { ingredientId: ing2.IngredientId, actualQuantity: 4 },
    ],
  });
  const stockIng1After = Number((await ingService.getById(ing1.IngredientId))!.CurrentStock);
  const stockIng2After = Number((await ingService.getById(ing2.IngredientId))!.CurrentStock);
  eq('stock ing1 décrémenté de 12', stockIng1Before - stockIng1After, 12);
  eq('stock ing2 décrémenté de 4', stockIng2Before - stockIng2After, 4);

  const consIng1 = op5.IngredientConsumptions.find((c) => c.IngredientId === ing1.id);
  const consIng2 = op5.IngredientConsumptions.find((c) => c.IngredientId === ing2.id);
  eq('cons[ing1].Variance (+20%)', Math.round(Number(consIng1!.Variance)), 20);
  eq('cons[ing2].Variance (-20%)', Math.round(Number(consIng2!.Variance)), -20);
  eq('op5.TotalCost > 0', Number(op5.TotalCost) > 0, true);

  // -----------------------------------------------------------------
  step(8, 'Création d\'un lot de 90 produits (95 produits, 5 défects)');
  const batch = await opService.createBatch(op.id!, {
    quantityProduced: 95,
    quantityDefective: 5,
    qualityScore: 92,
  });
  eq('batch.QuantityGood', Number(batch.QuantityGood), 90);
  eq('batch.QualityScore', Number(batch.QualityScore!), 92);

  const op6 = await opService.getById(op.id!);
  eq('après batch, op.ProducedQuantity', Number(op6!.ProducedQuantity), 90);
  // YieldRate = 90/100 = 90%
  eq('après batch, op.YieldRate', Math.round(Number(op6!.YieldRate)), 90);

  // -----------------------------------------------------------------
  step(9, 'Complete OP');
  const op7 = await opService.complete(op.id!);
  eq('après complete, op.Status', op7.Status, 'completed');

  // -----------------------------------------------------------------
  step(10, 'Cleanup');
  // Delete dans l'ordre inverse pour respecter FK
  for (const id of cleanup.expenseIds) {
    await pool.query(`DELETE FROM expenses WHERE id = $1`, [id]);
  }
  for (const id of cleanup.productionOrders) {
    await pool.query(`DELETE FROM production_orders WHERE id = $1`, [id]);
  }
  for (const id of cleanup.purchaseRequests) {
    // Delete approval steps + lines + er
    await pool.query(`DELETE FROM expense_approval_steps WHERE expense_request_id = $1`, [id]);
    await pool.query(`DELETE FROM purchase_request_lines WHERE expense_request_id = $1`, [id]);
    await pool.query(`DELETE FROM expense_requests WHERE id = $1`, [id]);
  }
  for (const id of cleanup.recipes) {
    await pool.query(`DELETE FROM recipes WHERE id = $1`, [id]);
  }
  for (const id of cleanup.ingredients) {
    await pool.query(`DELETE FROM ingredient_receptions WHERE ingredient_id = $1`, [id]);
    await pool.query(`DELETE FROM ingredients WHERE id = $1`, [id]);
  }
  ok('données de test supprimées');

  await pool.end();

  console.log(`\n=== ${failed === 0 ? '✅ ALL PASS' : `❌ ${failed} ASSERTION(S) FAILED`} ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('\n❌ Erreur fatale :', e.message);
  console.error(e.stack);
  // Tente le cleanup quand même
  try {
    for (const id of cleanup.expenseIds) await pool.query(`DELETE FROM expenses WHERE id = $1`, [id]);
    for (const id of cleanup.productionOrders) await pool.query(`DELETE FROM production_orders WHERE id = $1`, [id]);
    for (const id of cleanup.purchaseRequests) {
      await pool.query(`DELETE FROM expense_approval_steps WHERE expense_request_id = $1`, [id]);
      await pool.query(`DELETE FROM purchase_request_lines WHERE expense_request_id = $1`, [id]);
      await pool.query(`DELETE FROM expense_requests WHERE id = $1`, [id]);
    }
    for (const id of cleanup.recipes) await pool.query(`DELETE FROM recipes WHERE id = $1`, [id]);
    for (const id of cleanup.ingredients) {
      await pool.query(`DELETE FROM ingredient_receptions WHERE ingredient_id = $1`, [id]);
      await pool.query(`DELETE FROM ingredients WHERE id = $1`, [id]);
    }
    console.error('Cleanup partiel effectué.');
  } catch {}
  await pool.end();
  process.exit(1);
});
