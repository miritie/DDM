#!/usr/bin/env tsx
/**
 * Importe les compositions depuis l'artefact Excel vers la base.
 *
 *  - Crée les produits manquants
 *  - Crée les matières premières manquantes (avec PMP initial = coût/g moyen
 *    déduit de l'Excel)
 *  - Crée les recettes manquantes (output_quantity = 1, output_unit dynamique
 *    selon le poids du sachet/pot)
 *  - Les macérats sont créés en kind='semi' (semi-finis fabricables en interne)
 *  - Le reste en kind='raw' (matières premières achetées)
 *
 * Dry-run par défaut. --apply pour écrire.
 *
 * Pré-requis : avoir lancé `python3 scripts/database/parse-compositions.py`
 * pour générer /tmp/compositions.json. (Ou bien on régénère ici.)
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const APPLY = process.argv.includes('--apply');
const ARTIFACT = '/Volumes/DATA/DEVS/DDM/artefacts/COMPOSITIONS  P.R-P.V. 2026.xlsx';
const JSON_OUT = '/tmp/compositions.json';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

// Mapping Excel → produit existant en DB (validé manuellement).
// Quand un code Excel apparaît ici, on réutilise le produit existant
// au lieu d'en créer un nouveau.
const REMAP_TO_EXISTING: Record<string, string> = {
  'BAOBAB': 'BAOBAB',
  'COMPLET-A-150': 'COMPLET-150G',
  'COMPLET-A-300': 'COMPLET-300G',
  '7EME': '7IEM',
  'FEVE-PT-COLA': 'FEVES-PCOLA',
};

// Mapping nom Excel → code court (lisible et stable)
function toProductCode(name: string, weight: number | null): string {
  // Cas particuliers explicites pour rendu propre
  if (name === 'CŒUR') return 'COEUR';
  if (name === 'COMPLET-A' && weight) return `COMPLET-A-${Math.round(weight)}`;
  if (name === "DELICE D'ALOES") return 'DELICE-DALOES';
  if (name === '7ÈME France') return '7EME-FRANCE';
  if (name === '7ÈME Belgique') return '7EME-BELGIQUE';

  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // accents
    .replace(/[''']/g, '')
    .replace(/[^A-Za-z0-9 -]/g, '')
    .trim().toUpperCase().replace(/\s+/g, '-');
}

// Nom affiché en base (différencie les COMPLET-A par leur poids)
function toProductDisplayName(name: string, weight: number | null): string {
  if (name === 'COMPLET-A' && weight) return `COMPLET-A ${Math.round(weight)}g`;
  return name;
}

// Résout le code "effectif" en DB après remap
function resolveProductCode(excelCode: string): string {
  return REMAP_TO_EXISTING[excelCode] ?? excelCode;
}

function toIngredientCode(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim().toUpperCase().replace(/\s+/g, '-');
}

interface ParsedIngredient {
  raw_name: string;
  name: string;          // normalisé
  quantity_g: number;
  cost_per_g: number | null;
}

interface ParsedProduct {
  name: string;
  weight_g: number | null;
  sale_price_xof: number | null;
  benefice_brut_xof: number | null;
  ingredients: ParsedIngredient[];
}

interface IngredientSummary {
  count: number;
  avg_cost_per_g_xof: number | null;
}

interface ParsedData {
  products: ParsedProduct[];
  ingredients_summary: Record<string, IngredientSummary>;
}

// Régénération du JSON si nécessaire (idempotent)
function regenerateJson(): void {
  if (fs.existsSync(JSON_OUT)) {
    const j = fs.statSync(JSON_OUT);
    const a = fs.statSync(ARTIFACT);
    if (j.mtime > a.mtime) return; // JSON plus récent que l'Excel
  }
  // Re-run le parser Python embarqué (même algorithme qu'au-dessus)
  const py = path.join(__dirname, '_parse-compositions.py');
  if (!fs.existsSync(py)) {
    throw new Error(`Parser Python manquant : ${py}`);
  }
  execSync(`python3 "${py}"`, { stdio: 'inherit' });
}

// Marqueurs : ingrédients semi-finis (fabricables en interne via une mini-recette)
const SEMI_FINISHED = new Set([
  'MACERAT GIROFLE',
  'MACERAT LIN',
  'MACERAT PETIT COLA',
]);

async function main() {
  console.log(`🚀 Import compositions Excel — mode ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  regenerateJson();

  const raw = fs.readFileSync(JSON_OUT, 'utf-8');
  const data: ParsedData = JSON.parse(raw);

  // Workspace + admin
  const wsR = await pool.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`);
  const workspaceUuid = wsR.rows[0].id;
  const adminR = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.role_id='admin' AND u.workspace_id=$1 LIMIT 1`,
    [workspaceUuid]
  );
  const adminUuid = adminR.rows[0].id;
  console.log(`  Workspace : ${workspaceUuid}`);

  // 1. Snapshot DB
  const existingProducts = await pool.query(
    `SELECT id, product_id, name, code FROM products WHERE workspace_id = $1`,
    [workspaceUuid]
  );
  const productByCode = new Map<string, any>(existingProducts.rows.map((r) => [r.code, r]));
  // NOTE : on ne déduplique plus par nom — 2 produits peuvent avoir le même nom
  // (ex: COMPLET-A 150g et 300g) avec des codes distincts. On se fie aux codes.

  const existingIngredients = await pool.query(
    `SELECT id, ingredient_id, name, code, unit_cost, current_stock FROM ingredients WHERE workspace_id = $1`,
    [workspaceUuid]
  );
  const ingredientByCode = new Map<string, any>(existingIngredients.rows.map((r) => [r.code, r]));

  const existingRecipes = await pool.query(
    `SELECT id, name, product_id FROM recipes WHERE workspace_id = $1 AND is_active = true`,
    [workspaceUuid]
  );
  const activeRecipeByProductUuid = new Map<string, any>(existingRecipes.rows.map((r) => [r.product_id, r]));

  console.log(`\n  En DB : ${existingProducts.rowCount} produits, ${existingIngredients.rowCount} ingrédients, ${existingRecipes.rowCount} recettes actives.`);

  // 2. Plan d'action
  const plan = {
    productsToCreate: [] as ParsedProduct[],
    productsFound: 0,
    ingredientsToCreate: [] as { name: string; code: string; cost: number; kind: 'raw' | 'semi' }[],
    ingredientsToUpdatePMP: [] as { code: string; oldPMP: number; newPMP: number }[],
    ingredientsFound: 0,
    recipesToCreate: [] as ParsedProduct[],
    recipesSkipped: [] as { product: string; reason: string }[],
  };

  // Plan produits
  for (const p of data.products) {
    const excelCode = toProductCode(p.name, p.weight_g);
    const effectiveCode = resolveProductCode(excelCode);
    if (productByCode.has(effectiveCode)) {
      plan.productsFound++;
    } else {
      plan.productsToCreate.push(p);
    }
  }

  // Plan ingrédients
  for (const [name, summary] of Object.entries(data.ingredients_summary)) {
    const code = toIngredientCode(name);
    const cost = summary.avg_cost_per_g_xof ?? 0;
    const kind: 'raw' | 'semi' = SEMI_FINISHED.has(name) ? 'semi' : 'raw';
    if (ingredientByCode.has(code)) {
      plan.ingredientsFound++;
      const existing = ingredientByCode.get(code);
      // Si le PMP courant est 0 (jamais réceptionné), on peut le mettre à jour avec le coût Excel
      if (Number(existing.current_stock) === 0 && Number(existing.unit_cost) === 0 && cost > 0) {
        plan.ingredientsToUpdatePMP.push({ code, oldPMP: Number(existing.unit_cost), newPMP: cost });
      }
    } else {
      plan.ingredientsToCreate.push({ name, code, cost, kind });
    }
  }

  // Plan recettes (besoin des UUIDs produits — on les résoudra à l'apply)
  for (const p of data.products) {
    const excelCode = toProductCode(p.name, p.weight_g);
    const effectiveCode = resolveProductCode(excelCode);
    const productInDb = productByCode.get(effectiveCode);
    if (!productInDb && !APPLY) {
      // En dry-run, on ne sait pas si la recette serait créée car le produit sera créé
      plan.recipesToCreate.push(p);
    } else if (productInDb) {
      if (activeRecipeByProductUuid.has(productInDb.id)) {
        plan.recipesSkipped.push({ product: p.name, reason: 'recette active existe déjà' });
      } else if (p.ingredients.length === 0) {
        plan.recipesSkipped.push({ product: p.name, reason: 'aucun ingrédient parsé' });
      } else {
        plan.recipesToCreate.push(p);
      }
    } else {
      // produit à créer + recette à créer
      if (p.ingredients.length === 0) {
        plan.recipesSkipped.push({ product: p.name, reason: 'aucun ingrédient parsé' });
      } else {
        plan.recipesToCreate.push(p);
      }
    }
  }

  // 3. Affichage du plan
  console.log(`\n📋 PLAN`);
  console.log(`  Produits : ${plan.productsFound} existent · ${plan.productsToCreate.length} à créer`);
  plan.productsToCreate.forEach((p) => console.log(`    + ${toProductCode(p.name, p.weight_g).padEnd(20)} ${p.name} (${p.weight_g}g, PV ${p.sale_price_xof})`));

  console.log(`\n  Ingrédients : ${plan.ingredientsFound} existent · ${plan.ingredientsToCreate.length} à créer · ${plan.ingredientsToUpdatePMP.length} PMP à initialiser`);
  plan.ingredientsToCreate.forEach((i) =>
    console.log(`    + ${i.code.padEnd(22)} ${i.name} (kind=${i.kind}, PMP initial ${i.cost.toFixed(2)} XOF/g)`)
  );
  plan.ingredientsToUpdatePMP.forEach((i) =>
    console.log(`    ⟳ ${i.code.padEnd(22)} PMP ${i.oldPMP} → ${i.newPMP.toFixed(2)} XOF/g`)
  );

  console.log(`\n  Recettes : ${plan.recipesToCreate.length} à créer · ${plan.recipesSkipped.length} ignorées`);
  plan.recipesToCreate.forEach((p) =>
    console.log(`    + ${p.name.padEnd(20)} ${p.ingredients.length} ingrédients`)
  );
  plan.recipesSkipped.forEach((s) => console.log(`    ⏭  ${s.product} — ${s.reason}`));

  if (!APPLY) {
    console.log(`\n💡 Dry-run terminé. Relance avec --apply pour écrire.`);
    await pool.end();
    return;
  }

  // 4. Apply
  console.log(`\n✍️  Application…`);

  // 4a. Créer les produits
  const newProductCodeToUuid = new Map<string, string>();
  for (const p of plan.productsToCreate) {
    const code = toProductCode(p.name, p.weight_g);
    const productId = `PROD-${uuidv4().slice(0, 8)}`;
    const displayName = toProductDisplayName(p.name, p.weight_g);
    const r = await pool.query(
      `INSERT INTO products (product_id, name, code, description, unit_price, currency, unit, is_active, workspace_id)
       VALUES ($1,$2,$3,$4,$5,'XOF',$6,true,$7) RETURNING id`,
      [
        productId, displayName, code,
        `Produit fini ${p.weight_g}g — importé depuis Excel`,
        p.sale_price_xof ?? 0,
        p.weight_g ? `sachet ${p.weight_g}g` : 'unit',
        workspaceUuid,
      ]
    );
    newProductCodeToUuid.set(code, r.rows[0].id);
    productByCode.set(code, { id: r.rows[0].id, code, name: p.name });
    console.log(`  ✓ produit créé : ${code}`);
  }

  // 4b. Créer les ingrédients
  const newIngredientCodeToUuid = new Map<string, string>();
  for (const i of plan.ingredientsToCreate) {
    const ingredientId = `ING-${uuidv4().slice(0, 8)}`;
    const r = await pool.query(
      `INSERT INTO ingredients (
         ingredient_id, name, code, unit, unit_cost, currency, minimum_stock, current_stock,
         kind, is_active, workspace_id
       ) VALUES ($1,$2,$3,'g',$4,'XOF',0,0,$5,true,$6) RETURNING id`,
      [ingredientId, i.name, i.code, i.cost, i.kind, workspaceUuid]
    );
    newIngredientCodeToUuid.set(i.code, r.rows[0].id);
    ingredientByCode.set(i.code, { id: r.rows[0].id, code: i.code, name: i.name });
    console.log(`  ✓ ingrédient créé : ${i.code} (${i.kind}, ${i.cost.toFixed(2)} XOF/g)`);
  }

  // 4c. Mettre à jour les PMP des ingrédients existants à 0
  for (const u of plan.ingredientsToUpdatePMP) {
    const existing = ingredientByCode.get(u.code);
    await pool.query(
      `UPDATE ingredients SET unit_cost = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [existing.id, u.newPMP]
    );
    console.log(`  ⟳ PMP initialisé : ${u.code} → ${u.newPMP.toFixed(2)} XOF/g`);
  }

  // 4d. Créer les recettes
  for (const p of plan.recipesToCreate) {
    if (p.ingredients.length === 0) continue;
    const excelCode = toProductCode(p.name, p.weight_g);
    const effectiveCode = resolveProductCode(excelCode);
    const product = productByCode.get(effectiveCode);
    if (!product) {
      console.log(`  ⚠ produit ${effectiveCode} introuvable, recette ignorée`);
      continue;
    }
    // Génère un recipe_number
    const now = new Date();
    const prefix = `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastR = await pool.query(
      `SELECT recipe_number FROM recipes WHERE workspace_id=$1 AND recipe_number LIKE $2 ORDER BY recipe_number DESC LIMIT 1`,
      [workspaceUuid, `${prefix}%`]
    );
    let next = 1;
    if (lastR.rows[0]) {
      const m = lastR.rows[0].recipe_number.match(/-(\d+)$/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    const recipeNumber = `${prefix}-${String(next).padStart(4, '0')}`;
    const recipeId = `REC-${uuidv4().slice(0, 8)}`;

    const recR = await pool.query(
      `INSERT INTO recipes (
         recipe_id, recipe_number, name, product_id, product_name, version,
         output_quantity, output_unit, yield_rate, is_active, workspace_id
       ) VALUES ($1,$2,$3,$4,$5,1,1,$6,100,true,$7) RETURNING id`,
      [
        recipeId, recipeNumber,
        `${p.name} — formule standard`,
        product.id, p.name,
        p.weight_g ? `sachet ${p.weight_g}g` : 'unit',
        workspaceUuid,
      ]
    );
    const recipeUuid = recR.rows[0].id;

    for (const line of p.ingredients) {
      const ingCode = toIngredientCode(line.name);
      const ing = ingredientByCode.get(ingCode);
      if (!ing) {
        console.log(`    ⚠ ingrédient ${ingCode} introuvable pour ${p.name} — ligne ignorée`);
        continue;
      }
      await pool.query(
        `INSERT INTO recipe_lines (
           recipe_line_id, recipe_id, ingredient_id, ingredient_name, quantity, unit, loss
         ) VALUES ($1,$2,$3,$4,$5,'g',0)`,
        [`RL-${uuidv4().slice(0, 8)}`, recipeUuid, ing.id, ing.name, line.quantity_g]
      );
    }
    console.log(`  ✓ recette créée : ${p.name} (${p.ingredients.length} lignes)`);
  }

  console.log(`\n✅ Import terminé.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌', e.message);
  console.error(e.stack);
  await pool.end();
  process.exit(1);
});
