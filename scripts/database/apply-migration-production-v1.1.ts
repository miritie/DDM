#!/usr/bin/env tsx
/**
 * Applique migration-production-v1.1.sql.
 * Ajoute production_orders.replenishment_id pour le pont OP↔réappro.
 * Idempotent.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const SQL_FILE = path.join(__dirname, 'migration-production-v1.1.sql');
const APPLY = !process.argv.includes('--dry-run');

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

(async () => {
  console.log(`🚀 Migration PRODUCTION v1.1 — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const sql = fs.readFileSync(SQL_FILE, 'utf-8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    if (APPLY) {
      await client.query('COMMIT');
      console.log('✅ Migration appliquée.');
    } else {
      await client.query('ROLLBACK');
      console.log('↩️  Dry-run : rollback.');
    }
  } catch (e: any) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
