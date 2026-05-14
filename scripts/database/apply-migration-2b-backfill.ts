#!/usr/bin/env tsx
/**
 * Migration 2b (volet backfill) — Peuple les colonnes `payment_method_id`
 * à partir des colonnes existantes `payment_method` (enum / varchar) en
 * croisant avec `payment_methods.code`.
 *
 * Idempotent : ne touche que les lignes où `payment_method_id IS NULL`
 * ET où `payment_method` n'est pas NULL.
 *
 * Tables traitées :
 *   - sale_payments      (enum NOT NULL)
 *   - expenses           (varchar nullable)
 *   - payrolls           (varchar nullable)
 *   - employee_advances  (varchar nullable)
 *   - customers          (preferred_payment_method varchar nullable → preferred_payment_method_id)
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}

interface BackfillSpec {
  table: string;
  sourceCol: string;
  targetCol: string;
}

const SPECS: BackfillSpec[] = [
  { table: 'sale_payments',     sourceCol: 'payment_method',           targetCol: 'payment_method_id' },
  { table: 'expenses',          sourceCol: 'payment_method',           targetCol: 'payment_method_id' },
  { table: 'payrolls',          sourceCol: 'payment_method',           targetCol: 'payment_method_id' },
  { table: 'employee_advances', sourceCol: 'payment_method',           targetCol: 'payment_method_id' },
  { table: 'customers',         sourceCol: 'preferred_payment_method', targetCol: 'preferred_payment_method_id' },
];

async function backfillTable(pool: Pool, spec: BackfillSpec): Promise<{ updated: number; skipped: number }> {
  // UPDATE en JOIN sur (workspace_id, code) — chaque ligne ne reçoit l'UUID
  // de la méthode appartenant à son propre workspace, pas une autre.
  const sql = `
    UPDATE ${spec.table} t
    SET ${spec.targetCol} = pm.id
    FROM payment_methods pm
    WHERE t.workspace_id = pm.workspace_id
      AND pm.code = t.${spec.sourceCol}::text
      AND t.${spec.targetCol} IS NULL
      AND t.${spec.sourceCol} IS NOT NULL
  `;
  const r = await pool.query(sql);

  // Compter les lignes qui restent non backfilled
  const remain = await pool.query(`
    SELECT COUNT(*)::int AS n FROM ${spec.table}
    WHERE ${spec.targetCol} IS NULL AND ${spec.sourceCol} IS NOT NULL
  `);

  return { updated: r.rowCount || 0, skipped: remain.rows[0].n };
}

async function main() {
  console.log('🚀 Migration 2b — backfill payment_method_id');
  console.log(`📡 Cible : ${DATABASE_URL!.split('@')[1].split('?')[0]}`);

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Connexion établie\n');

    let totalUpdated = 0;
    let totalSkipped = 0;
    for (const spec of SPECS) {
      // La table peut ne pas exister (cas de partner_settlements en 2a)
      const exists = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
        [spec.table]
      );
      if (exists.rowCount === 0) {
        console.log(`⏭️  ${spec.table} : table absente, skip`);
        continue;
      }
      const r = await backfillTable(pool, spec);
      totalUpdated += r.updated;
      totalSkipped += r.skipped;
      console.log(`  • ${spec.table.padEnd(20)} : ${r.updated} lignes peuplées, ${r.skipped} lignes sans correspondance`);
    }

    console.log(`\n✅ Backfill terminé : ${totalUpdated} lignes mises à jour.`);
    if (totalSkipped > 0) {
      console.log(`⚠️  ${totalSkipped} ligne(s) sans correspondance — leur code ${spec_label_list()} ne matche aucun payment_methods.code dans le même workspace.`);
      console.log('   Vérifier manuellement (peut indiquer un code legacy à créer en table).');
    }
  } catch (e: any) {
    console.error('\n❌ Erreur :', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function spec_label_list() {
  return SPECS.map(s => `${s.table}.${s.sourceCol}`).join(' / ');
}

main();
