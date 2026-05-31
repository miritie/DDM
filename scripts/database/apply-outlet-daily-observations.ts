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
  const sql = fs.readFileSync(path.join(__dirname, 'migration-outlet-daily-observations.sql'), 'utf8');
  console.log('Création table outlet_daily_observations…');
  await pool.query(sql);
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='outlet_daily_observations'`
  );
  console.log(`Table outlet_daily_observations : ${r.rowCount! > 0 ? 'OK' : 'MANQUANTE'}`);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
