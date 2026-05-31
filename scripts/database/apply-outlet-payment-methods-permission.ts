#!/usr/bin/env tsx
/**
 * Crée la permission `outlet:payment_methods:manage` et l'attribue à
 * admin, manager_commercial et manager_compta_stocks (le comptable).
 *
 * Pourquoi une perm dédiée plutôt qu'élargir outlet:edit ?
 *   outlet:edit autorise aussi renommer/désactiver/déplacer un outlet,
 *   ce que le comptable ne doit pas pouvoir faire. Cette nouvelle perm
 *   isole strictement la gestion des moyens de paiement par stand.
 *
 * Idempotent. Trace dans role_permissions_audit avec
 * source='migration:outlet-payment-methods'.
 *
 * Usage : npm run migrate:outlet-payment-methods-perm
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trouvée');
  process.exit(1);
}

const PERM = {
  code: 'outlet:payment_methods:manage',
  name: 'Gérer les moyens de paiement acceptés par point de vente',
  module: 'outlet',
  description:
    'Permet de cocher / décocher les moyens de paiement autorisés sur ' +
    'chaque stand depuis /admin/outlets/[id]. Distinct de outlet:edit ' +
    '(qui permet aussi de renommer/désactiver le stand).',
};

const ROLES_TO_GRANT = ['admin', 'manager_commercial', 'manager_compta_stocks'];
const AUDIT_SOURCE = 'migration:outlet-payment-methods';

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  console.log('Permission outlet:payment_methods:manage → admin / manager commercial / comptable');

  try {
    await pool.query(
      `INSERT INTO permissions (permission_id, code, name, module, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         module = EXCLUDED.module`,
      [PERM.code, PERM.code, PERM.name, PERM.module, PERM.description]
    );

    const permRow = await pool.query(`SELECT id FROM permissions WHERE code = $1`, [PERM.code]);
    if (permRow.rowCount === 0) throw new Error('Permission introuvable après upsert');
    const permUuid = permRow.rows[0].id;

    const hasAudit = (await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'role_permissions_audit'`
    )).rowCount! > 0;

    let grants = 0;
    let skips = 0;
    let missing = 0;
    for (const roleCode of ROLES_TO_GRANT) {
      const role = await pool.query(`SELECT id FROM roles WHERE role_id = $1`, [roleCode]);
      if (role.rowCount === 0) {
        console.log(`  ${roleCode.padEnd(24)} rôle introuvable`);
        missing++;
        continue;
      }
      const r = await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING role_id`,
        [role.rows[0].id, permUuid]
      );
      if (r.rowCount && r.rowCount > 0) {
        console.log(`  ${roleCode.padEnd(24)} ← outlet:payment_methods:manage`);
        grants++;
        if (hasAudit) {
          await pool.query(
            `INSERT INTO role_permissions_audit (role_id, permission_id, action, changed_by, source)
             VALUES ($1, $2, 'GRANT', NULL, $3)`,
            [role.rows[0].id, permUuid, AUDIT_SOURCE]
          );
        }
      } else {
        console.log(`  ${roleCode.padEnd(24)} déjà autorisé`);
        skips++;
      }
    }

    console.log(`\nRésumé : ${grants} attribution(s), ${skips} déjà présente(s), ${missing} rôle(s) absent(s).`);
  } catch (e: any) {
    console.error('Erreur :', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
