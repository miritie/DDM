#!/usr/bin/env tsx
/**
 * Migration : Approvisionnements stands (commandes internes).
 * Crée 3 tables + 1 colonne FK sur stock_movements. Additive et idempotente.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL non trouvée'); process.exit(1); }

const FILE = path.join(__dirname, 'migration-stand-replenishments.sql');

async function main() {
  console.log('🚀 Migration : Approvisionnements stands');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query('SELECT NOW()');
    const sql = fs.readFileSync(FILE, 'utf-8');
    await pool.query(sql);

    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'stand_replenishment%'
      ORDER BY table_name
    `);
    console.log('✅ Tables créées :', tables.rows.map(r => r.table_name).join(', '));

    const enumCheck = await pool.query(`SELECT 1 FROM pg_type WHERE typname='replenishment_status'`);
    console.log('  • enum replenishment_status :', enumCheck.rowCount === 1 ? '✅' : '❌');

    const fkCheck = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='stock_movements' AND column_name='replenishment_target_id'
    `);
    console.log('  • stock_movements.replenishment_target_id :', fkCheck.rowCount === 1 ? '✅' : '❌');
  } catch (e: any) {
    console.error('❌', e.message); process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
