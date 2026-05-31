#!/usr/bin/env tsx
/**
 * Applique migration-outlet-allows-credit.sql.
 * Ajoute outlets.allows_credit BOOLEAN DEFAULT FALSE.
 *
 * Usage : npm run migrate:outlet-allows-credit
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trouvée');
  process.exit(1);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const sql = fs.readFileSync(path.join(__dirname, 'migration-outlet-allows-credit.sql'), 'utf8');

  console.log('Ajout outlets.allows_credit…');
  await pool.query(sql);

  const r = await pool.query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='outlets' AND column_name='allows_credit'`
  );
  console.log(`outlets.allows_credit : ${r.rowCount! > 0 ? 'OK (default=' + r.rows[0].column_default + ')' : 'MANQUANT'}`);

  await pool.end();
}

main().catch((err) => { console.error('Erreur :', err); process.exit(1); });
