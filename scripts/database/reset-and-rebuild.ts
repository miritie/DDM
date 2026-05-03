#!/usr/bin/env tsx
/**
 * Reset complet de la base : drop schema public + recreate + re-exécution des 3 schémas SQL.
 *
 * Usage: tsx scripts/database/reset-and-rebuild.ts
 *
 * À utiliser uniquement en environnement de développement / données de test.
 * Refuse de tourner si DATABASE_URL pointe vers une instance contenant le mot "prod".
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL absente de .env.local');
  process.exit(1);
}

if (/prod|production/i.test(DATABASE_URL)) {
  console.error('❌ Refus : DATABASE_URL semble pointer vers une instance de production.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function dropAndRecreatePublicSchema(): Promise<void> {
  console.log('🧨 Drop schema public CASCADE…');
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.query('GRANT ALL ON SCHEMA public TO public');
  console.log('✅ Schema public recréé (vide)');
}

async function executeSQLFile(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);
  console.log(`\n📄 ${fileName}`);
  const sql = fs.readFileSync(filePath, 'utf-8');
  await pool.query(sql);
  console.log(`   ✅ exécuté`);
}

async function verifyTables(): Promise<void> {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  console.log(`\n📊 ${result.rows[0].count} tables créées`);

  const outletsCheck = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('outlets', 'outlet_types', 'outlet_periods', 'outlet_prices',
                         'outlet_assignments', 'outlet_assignment_overrides',
                         'pos_sessions', 'pending_client_scans', 'outlet_invoices')
    ORDER BY table_name
  `);
  console.log(`✅ Tables outlets présentes :`);
  outletsCheck.rows.forEach((r: any) => console.log(`   - ${r.table_name}`));
}

async function main(): Promise<void> {
  const host = DATABASE_URL!.split('@')[1]?.split('?')[0] ?? 'inconnu';
  console.log(`🚀 Reset DDM sur ${host}`);

  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Connexion OK');

    await dropAndRecreatePublicSchema();

    const dir = __dirname;
    await executeSQLFile(path.join(dir, 'schema.sql'));
    await executeSQLFile(path.join(dir, 'schema-part2.sql'));
    await executeSQLFile(path.join(dir, 'schema-part3.sql'));

    await verifyTables();

    console.log('\n🎉 Reset terminé. Lancez ensuite :');
    console.log('   npx tsx scripts/seed-permissions.ts');
    console.log('   npx tsx scripts/init-users.ts');
  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
