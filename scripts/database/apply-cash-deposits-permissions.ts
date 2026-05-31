#!/usr/bin/env tsx
/**
 * Crée les permissions cash:deposit:create et cash:deposit:validate
 * et les attribue aux rôles appropriés :
 *   - create   : agent_commercial, manager_commercial, manager_compta_stocks, admin
 *   - validate : manager_compta_stocks, admin (ségrégation des pouvoirs)
 *
 * Idempotent.
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL non trouvée'); process.exit(1); }

const PERMS = [
  {
    code: 'cash:deposit:create',
    name: 'Enregistrer un versement de caisse',
    module: 'cash',
    description: 'Permet à un vendeur de saisir un dépôt de tout ou partie de la caisse espèces (banque / mobile money / remise à responsable). Décrémente immédiatement le wallet caisse.',
    roles: ['admin', 'agent_commercial', 'commercial', 'manager_commercial', 'manager_compta_stocks'],
  },
  {
    code: 'cash:deposit:validate',
    name: 'Valider ou rejeter un versement de caisse',
    module: 'cash',
    description: 'Permet au comptable de valider un versement pending (RAS, le wallet est déjà débité) ou de le rejeter (re-crédit du wallet caisse).',
    roles: ['admin', 'manager_compta_stocks'],
  },
];

const AUDIT_SOURCE = 'migration:cash-deposits';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.log('Permissions cash:deposit:* → rôles');

  try {
    const hasAudit = (await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='role_permissions_audit'`
    )).rowCount! > 0;

    for (const perm of PERMS) {
      await pool.query(
        `INSERT INTO permissions (permission_id, code, name, module, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, module=EXCLUDED.module`,
        [perm.code, perm.code, perm.name, perm.module, perm.description]
      );
      const permRow = await pool.query(`SELECT id FROM permissions WHERE code=$1`, [perm.code]);
      const permUuid = permRow.rows[0].id;
      console.log(`\n  Permission ${perm.code} :`);

      for (const roleCode of perm.roles) {
        const role = await pool.query(`SELECT id FROM roles WHERE role_id=$1`, [roleCode]);
        if (role.rowCount === 0) { console.log(`    ${roleCode.padEnd(24)} rôle absent`); continue; }
        const r = await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING role_id`,
          [role.rows[0].id, permUuid]
        );
        if (r.rowCount && r.rowCount > 0) {
          console.log(`    ${roleCode.padEnd(24)} GRANT`);
          if (hasAudit) {
            await pool.query(
              `INSERT INTO role_permissions_audit (role_id, permission_id, action, changed_by, source)
               VALUES ($1, $2, 'GRANT', NULL, $3)`,
              [role.rows[0].id, permUuid, AUDIT_SOURCE]
            );
          }
        } else {
          console.log(`    ${roleCode.padEnd(24)} déjà OK`);
        }
      }
    }

    console.log('\nDone.');
  } catch (e: any) {
    console.error('Erreur :', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
