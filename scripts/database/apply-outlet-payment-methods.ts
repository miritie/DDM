#!/usr/bin/env tsx
/**
 * Applique migration-outlet-payment-methods.sql.
 * Crée la table de jointure outlet ↔ payment_methods.
 *
 * Usage : npx tsx scripts/database/apply-outlet-payment-methods.ts
 *         npm run migrate:outlet-payment-methods
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

const SQL_FILE = path.join(__dirname, 'migration-outlet-payment-methods.sql');

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const sql = fs.readFileSync(SQL_FILE, 'utf8');

  console.log('Création de la table outlet_payment_methods…');
  await pool.query(sql);

  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'outlet_payment_methods'`
  );
  console.log(`Table outlet_payment_methods : ${r.rowCount! > 0 ? 'OK' : 'MANQUANTE'}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Erreur migration :', err);
  process.exit(1);
});
