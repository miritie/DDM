#!/usr/bin/env tsx
/**
 * Applique migration-cash-deposits.sql.
 * Crée la table cash_deposits + 2 enums + 4 index + trigger updated_at.
 *
 * Usage : npm run migrate:cash-deposits
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL non trouvée'); process.exit(1); }

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const sql = fs.readFileSync(path.join(__dirname, 'migration-cash-deposits.sql'), 'utf8');

  console.log('Création de la table cash_deposits…');
  await pool.query(sql);

  const tbl = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'cash_deposits'`
  );
  console.log(`Table cash_deposits : ${tbl.rowCount! > 0 ? 'OK' : 'MANQUANTE'}`);

  await pool.end();
}

main().catch((err) => { console.error('Erreur :', err); process.exit(1); });
