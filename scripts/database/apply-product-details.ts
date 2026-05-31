#!/usr/bin/env tsx
/**
 * Applique migration-product-details.sql.
 * Ajoute benefits/usage_notes/composition à products + crée la table
 * product_images pour le carrousel POS.
 *
 * Usage : npx tsx scripts/database/apply-product-details.ts
 *         npm run migrate:product-details
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

const SQL_FILE = path.join(__dirname, 'migration-product-details.sql');

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const sql = fs.readFileSync(SQL_FILE, 'utf8');

  console.log('Application de la migration product-details…');
  await pool.query(sql);

  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'products'
       AND column_name IN ('benefits', 'usage_notes', 'composition')
     ORDER BY column_name`
  );
  console.log(`Colonnes products ajoutées (${cols.rowCount}/3) :`);
  for (const row of cols.rows) console.log(`  ${row.column_name}`);

  const tbl = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'product_images'`
  );
  console.log(`Table product_images : ${tbl.rowCount! > 0 ? 'OK' : 'MANQUANTE'}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Erreur migration :', err);
  process.exit(1);
});
