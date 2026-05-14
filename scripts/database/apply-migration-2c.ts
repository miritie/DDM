#!/usr/bin/env tsx
/**
 * Migration 2c — cleanup destructif (NOT NULL + DROP colonnes + DROP TYPE).
 *
 * DESTRUCTIF. Vérifie avant exécution que toutes les lignes ont leur FK
 * `payment_method_id` peuplée, sinon ALTER ... SET NOT NULL échouera et la
 * migration s'arrêtera proprement (transaction).
 *
 * Usage :
 *   npm run migrate:2c:dry-run    # affiche le SQL sans rien faire
 *   npm run migrate:2c            # exécute
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const MIGRATION_FILE = path.join(__dirname, 'migration-2c-cleanup.sql');

async function preflight(pool: Pool): Promise<{ ok: boolean; details: string[] }> {
  const checks: { table: string; source: string; target: string }[] = [
    { table: 'sale_payments',     source: 'payment_method',           target: 'payment_method_id' },
    { table: 'expenses',          source: 'payment_method',           target: 'payment_method_id' },
    { table: 'payrolls',          source: 'payment_method',           target: 'payment_method_id' },
    { table: 'employee_advances', source: 'payment_method',           target: 'payment_method_id' },
    { table: 'customers',         source: 'preferred_payment_method', target: 'preferred_payment_method_id' },
  ];
  const details: string[] = [];
  let ok = true;
  for (const c of checks) {
    const colCheck = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [c.table, c.source]
    );
    if (colCheck.rowCount === 0) {
      details.push(`✓ ${c.table}.${c.source} : déjà supprimée (idempotent)`);
      continue;
    }
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ${c.table} WHERE ${c.source} IS NOT NULL AND ${c.target} IS NULL`
    );
    const n = r.rows[0].n;
    if (n > 0) {
      ok = false;
      details.push(`✗ ${c.table} : ${n} ligne(s) avec ${c.source} renseigné mais ${c.target} NULL — backfill requis avant DROP.`);
    } else {
      details.push(`✓ ${c.table} : prêt (${c.source}→${c.target} cohérent)`);
    }
  }
  return { ok, details };
}

async function main() {
  console.log('🚀 Migration 2c — cleanup destructif des moyens de paiement legacy');
  console.log(`📡 Cible : ${DATABASE_URL!.split('@')[1].split('?')[0]}`);
  console.log(DRY_RUN ? '🔍 Mode DRY-RUN' : '✍️  Mode WRITE (DESTRUCTIF, irréversible)');

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
  if (DRY_RUN) {
    console.log('\n--- SQL qui serait exécuté ---\n');
    console.log(sql);
    return;
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Connexion établie\n');

    console.log('📋 Preflight checks :');
    const pre = await preflight(pool);
    pre.details.forEach(d => console.log('  ' + d));
    if (!pre.ok) {
      console.error('\n❌ Preflight a échoué — abandon. Lancez `npm run migrate:2b:backfill` puis re-essayez.');
      process.exit(2);
    }

    console.log('\n📄 Application de migration-2c-cleanup.sql ...');
    // Encadre la migration dans une transaction pour qu'elle soit atomique.
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('COMMIT');
      console.log('✅ Migration appliquée et commitée');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    // Vérifications post-migration
    console.log('\n📊 Vérifications post-migration :');
    const enumLeft = await pool.query(`SELECT 1 FROM pg_type WHERE typname='payment_method'`);
    console.log(`  • enum payment_method supprimé : ${enumLeft.rowCount === 0 ? '✅' : '❌ encore présent'}`);

    const cols = await pool.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema='public'
         AND (column_name='payment_method' OR column_name='preferred_payment_method')`
    );
    console.log(`  • colonnes legacy restantes : ${cols.rowCount === 0 ? '✅ aucune' : '❌ ' + cols.rows.map(r => `${r.table_name}.${r.column_name}`).join(', ')}`);

    const notnull = await pool.query(
      `SELECT is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='sale_payments' AND column_name='payment_method_id'`
    );
    console.log(`  • sale_payments.payment_method_id NOT NULL : ${notnull.rows[0]?.is_nullable === 'NO' ? '✅' : '❌'}`);

    console.log('\n🎉 Migration 2c terminée. Étape suivante (Phase D) : cleanup code côté services.');
  } catch (e: any) {
    console.error('\n❌ Erreur :', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
