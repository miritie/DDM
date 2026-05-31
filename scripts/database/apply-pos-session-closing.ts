#!/usr/bin/env tsx
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL manquant'); process.exit(1); }

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const sql = fs.readFileSync(path.join(__dirname, 'migration-pos-session-closing.sql'), 'utf8');
  console.log('Ajout colonnes pos_sessions closing_*…');
  await pool.query(sql);
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='pos_sessions' AND column_name LIKE 'closing_%' OR column_name='closed_by_id'`
  );
  console.log(`Colonnes ajoutées : ${cols.rowCount}`);
  for (const r of cols.rows) console.log('  ' + r.column_name);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
