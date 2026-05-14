#!/usr/bin/env tsx
/**
 * Synchronise les permissions CLIENT_VIEW / CREATE / EDIT en DB et les
 * attribue aux rôles admin, manager_commercial, manager_compta_stocks.
 * Idempotent.
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non trouvée'); process.exit(1);
}

const NEW_PERMS = [
  { code: 'client:view',   name: 'Voir les clients grossistes',   module: 'client' },
  { code: 'client:create', name: 'Créer un client grossiste',     module: 'client' },
  { code: 'client:edit',   name: 'Modifier un client grossiste',  module: 'client' },
];

// Codes rôles métier (dans la DB sur roles.role_id).
const ROLES_TO_GRANT: Record<string, string[]> = {
  admin:                 ['client:view', 'client:create', 'client:edit'],
  manager_commercial:    ['client:view', 'client:create', 'client:edit'],
  manager_compta_stocks: ['client:view'],
  pca:                   ['client:view'],
};

async function main() {
  console.log('🚀 Permissions CLIENT_* (clients grossistes B2B)');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const p of NEW_PERMS) {
      await pool.query(
        `INSERT INTO permissions (permission_id, code, name, module, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO NOTHING`,
        [p.code, p.code, p.name, p.module, p.name]
      );
    }
    console.log(`✅ ${NEW_PERMS.length} permissions garanties`);

    let grants = 0;
    for (const [roleCode, permCodes] of Object.entries(ROLES_TO_GRANT)) {
      const role = await pool.query(`SELECT id FROM roles WHERE role_id = $1 LIMIT 1`, [roleCode]);
      if (role.rowCount === 0) { console.log(`⏭️  rôle ${roleCode} introuvable`); continue; }
      const roleUuid = role.rows[0].id;
      for (const code of permCodes) {
        const perm = await pool.query(`SELECT id FROM permissions WHERE code = $1 LIMIT 1`, [code]);
        if (perm.rowCount === 0) continue;
        const r = await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING role_id`,
          [roleUuid, perm.rows[0].id]
        );
        if (r.rowCount && r.rowCount > 0) grants++;
      }
    }
    console.log(`✅ ${grants} attribution(s) créée(s)`);
  } catch (e: any) {
    console.error('❌', e.message); process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
