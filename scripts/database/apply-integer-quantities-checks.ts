#!/usr/bin/env tsx
/**
 * Applique migration-finished-product-integer-quantities.sql.
 *
 * Préalable : npx tsx scripts/database/audit-fractional-quantities.ts
 * doit avoir affiché « Aucune fraction détectée ». Sinon les ALTER
 * TABLE échoueront sur la première colonne sale.
 *
 * Usage :
 *   npx tsx scripts/database/apply-integer-quantities-checks.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}

const SQL_FILE = path.join(__dirname, 'migration-finished-product-integer-quantities.sql');

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const sql = fs.readFileSync(SQL_FILE, 'utf8');

  console.log('Application des CHECK constraints quantités entières…');
  await pool.query(sql);

  const r = await pool.query(
    `SELECT conname FROM pg_constraint
     WHERE conname LIKE 'chk_%integer' ORDER BY conname`
  );
  console.log(`\n${r.rows.length} contraintes installées :`);
  for (const row of r.rows) console.log(`  ${row.conname}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Erreur migration :', err);
  process.exit(1);
});
