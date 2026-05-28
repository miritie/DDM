#!/usr/bin/env tsx
/**
 * Audit des quantités fractionnaires en base.
 *
 * Décision métier : les produits finis se comptent en unités entières.
 * Ce script scanne toutes les colonnes « produit fini » et compte les
 * lignes dont la valeur n'est pas entière, pour décider si on peut
 * ajouter une contrainte SQL CHECK ou s'il faut d'abord réparer / arrondir.
 *
 * Usage : npx tsx scripts/database/audit-fractional-quantities.ts
 *
 * Les colonnes « dosage d'ingrédient » (recipe_lines, ingredient_consumptions,
 * ingredients.*, purchase_request_lines) sont volontairement exclues : elles
 * doivent rester fractionnaires (kg / g / L).
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface ColumnTarget {
  table: string;
  column: string;
}

const FINISHED_PRODUCT_COLUMNS: ColumnTarget[] = [
  { table: 'sale_items',                   column: 'quantity' },
  { table: 'stock_items',                  column: 'quantity' },
  { table: 'stock_items',                  column: 'minimum_stock' },
  { table: 'stock_items',                  column: 'maximum_stock' },
  { table: 'stock_movements',              column: 'quantity' },
  { table: 'stock_alerts',                 column: 'current_quantity' },
  { table: 'stock_alerts',                 column: 'threshold_quantity' },
  { table: 'production_orders',            column: 'planned_quantity' },
  { table: 'production_orders',            column: 'produced_quantity' },
  { table: 'production_batches',           column: 'quantity_produced' },
  { table: 'production_batches',           column: 'quantity_defective' },
  { table: 'recipes',                      column: 'output_quantity' },
  { table: 'stock_transfer_lines',         column: 'qty_sent' },
  { table: 'stock_transfer_lines',         column: 'qty_received' },
  { table: 'stand_replenishment_lines',    column: 'quantity_requested' },
  { table: 'stand_replenishment_lines',    column: 'quantity_produced' },
  { table: 'stand_replenishment_targets',  column: 'quantity_target' },
  { table: 'stand_replenishment_targets',  column: 'quantity_received' },
  { table: 'customer_order_lines',         column: 'quantity' },
];

async function tableExists(name: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return r.rowCount! > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return r.rowCount! > 0;
}

async function auditColumn(target: ColumnTarget): Promise<{
  target: ColumnTarget;
  total: number | null;
  fractional: number | null;
  samples: Array<{ id: string; value: string }>;
  note: string;
}> {
  if (!(await tableExists(target.table))) {
    return { target, total: null, fractional: null, samples: [], note: 'table absente' };
  }
  if (!(await columnExists(target.table, target.column))) {
    return { target, total: null, fractional: null, samples: [], note: 'colonne absente' };
  }

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS c FROM ${target.table}`);
  const total = totalRes.rows[0].c as number;

  const fracRes = await pool.query(
    `SELECT COUNT(*)::int AS c FROM ${target.table}
     WHERE ${target.column} IS NOT NULL AND ${target.column} <> floor(${target.column})`
  );
  const fractional = fracRes.rows[0].c as number;

  let samples: Array<{ id: string; value: string }> = [];
  if (fractional > 0) {
    const sampleRes = await pool.query(
      `SELECT id::text AS id, ${target.column}::text AS value
       FROM ${target.table}
       WHERE ${target.column} IS NOT NULL AND ${target.column} <> floor(${target.column})
       LIMIT 5`
    );
    samples = sampleRes.rows;
  }

  return { target, total, fractional, samples, note: '' };
}

async function main(): Promise<void> {
  console.log('Audit des quantités fractionnaires sur colonnes produit fini\n');

  const results = await Promise.all(FINISHED_PRODUCT_COLUMNS.map(auditColumn));

  const headerCol = 'table.column'.padEnd(48);
  console.log(`${headerCol}  ${'total'.padStart(8)}  ${'fract'.padStart(8)}  note`);
  console.log('-'.repeat(48 + 2 + 8 + 2 + 8 + 2 + 20));

  let totalFractional = 0;
  let cleanColumns = 0;
  let dirtyColumns = 0;
  let missingColumns = 0;

  for (const r of results) {
    const label = `${r.target.table}.${r.target.column}`.padEnd(48);
    if (r.note) {
      console.log(`${label}  ${'-'.padStart(8)}  ${'-'.padStart(8)}  ${r.note}`);
      missingColumns++;
      continue;
    }
    const total = String(r.total).padStart(8);
    const frac = String(r.fractional).padStart(8);
    const flag = r.fractional! > 0 ? 'FRACTIONS' : 'ok';
    console.log(`${label}  ${total}  ${frac}  ${flag}`);
    if (r.fractional! > 0) {
      dirtyColumns++;
      totalFractional += r.fractional!;
      for (const s of r.samples) {
        console.log(`  └─ id=${s.id} ${r.target.column}=${s.value}`);
      }
    } else {
      cleanColumns++;
    }
  }

  console.log('\nSynthèse');
  console.log(`  ${cleanColumns}   colonnes propres (peuvent recevoir une CHECK constraint immédiatement)`);
  console.log(`  ${dirtyColumns}   colonnes avec valeurs fractionnaires  (à réparer ou arrondir avant CHECK)`);
  console.log(`  ${missingColumns} colonnes absentes en base (table/colonne non encore créée)`);
  console.log(`  ${totalFractional} lignes fractionnaires au total\n`);

  if (dirtyColumns === 0) {
    console.log('Aucune fraction détectée — la migration CHECK peut être appliquée sans réparation préalable.');
  } else {
    console.log('Des fractions existent — à passer en revue avant migration. Options :');
    console.log('  1. ROUND/FLOOR en masse via UPDATE (perte de précision assumée)');
    console.log('  2. Réparation manuelle ligne par ligne');
    console.log('  3. Renoncer à la CHECK constraint sur les colonnes concernées et se contenter de la validation applicative');
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Erreur audit :', err);
  pool.end().finally(() => process.exit(1));
});
