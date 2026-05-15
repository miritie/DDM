#!/usr/bin/env tsx
/**
 * Applique migration-stock-transfers.sql + grants stock:transfer.
 * Idempotent.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

(async () => {
  console.log('🚀 Migration STOCK TRANSFERS');
  const sql = fs.readFileSync(path.join(__dirname, 'migration-stock-transfers.sql'), 'utf-8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Tables/enums créés.\n');
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('❌', e.message);
    process.exit(1);
  } finally { client.release(); }

  // Grant stock:transfer à tous les rôles qui ont stock:view
  console.log('Permissions stock:transfer → tous rôles ayant stock:view\n');
  const rolesR = await pool.query(`
    SELECT DISTINCT r.id, r.role_id
    FROM roles r
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.code = 'stock:view' AND r.is_active = true
  `);
  const permR = await pool.query(`SELECT id FROM permissions WHERE code = 'stock:transfer'`);
  if (permR.rowCount === 0) {
    console.log('⚠ Permission stock:transfer introuvable (non seedée). Skip.');
  } else {
    let grants = 0, skips = 0;
    for (const role of rolesR.rows as any[]) {
      const r = await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING role_id`,
        [role.id, permR.rows[0].id]
      );
      if (r.rowCount && r.rowCount > 0) {
        console.log(`✅ ${role.role_id.padEnd(24)} ← stock:transfer`);
        grants++;
      } else { skips++; }
    }
    console.log(`\n${grants} grant(s) créés, ${skips} déjà présents.`);
  }

  await pool.end();
})();
