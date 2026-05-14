#!/usr/bin/env tsx
/**
 * Applique migration-production-v1.sql.
 *
 * - ingredients : kind, recipe_id, preferred_supplier_account_id (PMP via unit_cost)
 * - production_orders : customer_order_id, recipe_version, audit submit/approve
 * - enum production_order_status : ajout 'submitted'
 * - tables purchase_request_lines + ingredient_receptions
 * - seed catégorie d'expense 'achat_mp' par workspace
 *
 * Idempotent — peut être ré-exécuté.
 * Usage : npm run migrate:production:v1 [-- --dry-run]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL absente de .env.local');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const SQL_FILE = path.join(__dirname, 'migration-production-v1.sql');

async function main() {
  console.log('🚀 Migration PRODUCTION v1');
  console.log(`   Source : ${SQL_FILE}`);
  console.log(`   Mode   : ${DRY_RUN ? 'DRY-RUN (rollback final)' : 'APPLY'}\n`);

  const sql = fs.readFileSync(SQL_FILE, 'utf-8');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    // ALTER TYPE ... ADD VALUE ne peut pas être suivi d'utilisation de la
    // valeur dans la même transaction. On le sort donc à part, hors tx.
    // Notre migration n'utilise pas la valeur 'submitted' juste après — on
    // pourrait laisser dans la tx — mais on préfère la sécurité.
    const enumStmt = `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = 'production_order_status'::regtype AND enumlabel = 'submitted'
        ) THEN
          ALTER TYPE production_order_status ADD VALUE 'submitted' BEFORE 'planned';
        END IF;
      END $$;
    `;
    console.log('→ Préparation enum production_order_status (hors transaction)…');
    await client.query(enumStmt);
    console.log('  ✓ enum OK');

    console.log('→ Application de la migration (en transaction)…');
    await client.query('BEGIN');
    await client.query(sql);

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('\n↩️  Dry-run : transaction annulée, rien n\'a été persisté (sauf enum hors-tx).');
    } else {
      await client.query('COMMIT');
      console.log('\n✅ Migration appliquée.');
    }
  } catch (e: any) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('\n❌ Erreur migration :', e.message);
    if (e.position) console.error('   Position SQL :', e.position);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
