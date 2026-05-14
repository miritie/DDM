#!/usr/bin/env tsx
/**
 * Migration 2b (volet permissions) — Synchronise PAYMENT_METHOD_VIEW / EDIT
 * dans la table `permissions` et les attribue aux rôles admin + comptable
 * existants en DB. Idempotent.
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}

const NEW_PERMS = [
  { code: 'payment_method:view', name: 'Voir les moyens de paiement', module: 'treasury' },
  { code: 'payment_method:edit', name: 'Configurer les moyens de paiement', module: 'treasury' },
];

// Codes role métier (tels que stockés en DB sur roles.role_id).
// Profils ayant la configuration des moyens de paiement : admin + comptable.
// PCA (président) reçoit la vue seule (consultation).
const ROLES_TO_GRANT: Record<string, string[]> = {
  admin:                 ['payment_method:view', 'payment_method:edit'],
  manager_compta_stocks: ['payment_method:view', 'payment_method:edit'],
  pca:                   ['payment_method:view'],
};

async function main() {
  console.log('🚀 Migration 2b — permissions PAYMENT_METHOD_*');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    // 1) Upsert les nouvelles permissions
    for (const p of NEW_PERMS) {
      await pool.query(
        `INSERT INTO permissions (permission_id, code, name, module, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO NOTHING`,
        [p.code, p.code, p.name, p.module, p.name]
      );
    }
    console.log(`✅ ${NEW_PERMS.length} permissions garanties dans la table permissions`);

    // 2) Attacher aux rôles concernés
    let grants = 0;
    for (const [roleCode, permCodes] of Object.entries(ROLES_TO_GRANT)) {
      // Trouver le rôle par son business code (role_id) — pattern DDM dual-id
      const roleRow = await pool.query(
        `SELECT id FROM roles WHERE role_id = $1 LIMIT 1`,
        [roleCode]
      );
      if (roleRow.rowCount === 0) {
        console.log(`⏭️  rôle ${roleCode} introuvable, skip`);
        continue;
      }
      const roleUuid = roleRow.rows[0].id;

      for (const permCode of permCodes) {
        const permRow = await pool.query(
          `SELECT id FROM permissions WHERE code = $1 LIMIT 1`,
          [permCode]
        );
        if (permRow.rowCount === 0) continue;
        const permUuid = permRow.rows[0].id;

        const inserted = await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING
           RETURNING role_id`,
          [roleUuid, permUuid]
        );
        if (inserted.rowCount && inserted.rowCount > 0) grants++;
      }
    }
    console.log(`✅ ${grants} attribution(s) créée(s) (les existantes sont conservées)`);
  } catch (e: any) {
    console.error('❌ Erreur :', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
