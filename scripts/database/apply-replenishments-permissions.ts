#!/usr/bin/env tsx
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL non trouvée'); process.exit(1); }

const NEW_PERMS = [
  { code: 'replenishment:view',       name: 'Voir les approvisionnements stands',         module: 'replenishment' },
  { code: 'replenishment:create',     name: 'Créer un approvisionnement stand',           module: 'replenishment' },
  { code: 'replenishment:approve',    name: 'Approuver un approvisionnement stand',       module: 'replenishment' },
  { code: 'replenishment:distribute', name: 'Distribuer un approvisionnement vers stands', module: 'replenishment' },
];

const ROLES_TO_GRANT: Record<string, string[]> = {
  admin:                 ['replenishment:view', 'replenishment:create', 'replenishment:approve', 'replenishment:distribute'],
  manager_commercial:    ['replenishment:view', 'replenishment:create', 'replenishment:distribute'],
  manager_production:    ['replenishment:view'],
  manager_compta_stocks: ['replenishment:view'],
  pca:                   ['replenishment:view'],
};

async function main() {
  console.log('🚀 Permissions REPLENISHMENT_*');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    for (const p of NEW_PERMS) {
      await pool.query(
        `INSERT INTO permissions (permission_id, code, name, module, description)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING`,
        [p.code, p.code, p.name, p.module, p.name]
      );
    }
    console.log(`✅ ${NEW_PERMS.length} permissions garanties`);
    let grants = 0;
    for (const [roleCode, perms] of Object.entries(ROLES_TO_GRANT)) {
      const role = await pool.query(`SELECT id FROM roles WHERE role_id = $1`, [roleCode]);
      if (role.rowCount === 0) { console.log(`⏭️  ${roleCode} introuvable`); continue; }
      for (const code of perms) {
        const perm = await pool.query(`SELECT id FROM permissions WHERE code = $1`, [code]);
        if (perm.rowCount === 0) continue;
        const r = await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING role_id`,
          [role.rows[0].id, perm.rows[0].id]
        );
        if (r.rowCount && r.rowCount > 0) grants++;
      }
    }
    console.log(`✅ ${grants} attribution(s) créée(s)`);
  } catch (e: any) { console.error('❌', e.message); process.exit(1); }
  finally { await pool.end(); }
}
main();
