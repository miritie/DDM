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
  const sql = fs.readFileSync(path.join(__dirname, 'migration-doc-counters.sql'), 'utf8');
  console.log('Création table doc_counters…');
  await pool.query(sql);
  const check = await pool.query(`SELECT to_regclass('public.doc_counters') AS t`);
  console.log(check.rows[0]?.t ? '✅ doc_counters prête' : '❌ doc_counters absente');
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
