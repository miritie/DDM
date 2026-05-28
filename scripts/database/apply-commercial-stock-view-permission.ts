#!/usr/bin/env tsx
/**
 * Attribue la permission `stock:view` aux rôles `agent_commercial` et
 * `commercial`.
 *
 * Pourquoi ?
 *   Depuis la refonte de /sales/quick (home du vendeur), l'écran affiche
 *   un badge de stock sur chaque bouton produit et un compteur de
 *   transferts à réceptionner. Ces deux fonctionnalités tapent sur des
 *   endpoints gardés par `stock:view` :
 *     - GET /api/stock/locations/outlet/{id}/summary  (badges qty)
 *     - GET /api/stock/transfers/incoming             (réceptions pending)
 *   Sans cette perm, l'UI tombe en mode dégradé silencieux (badges
 *   « stock ? », compteur 0).
 *
 * Idempotent — réexécutable sans danger. Trace dans role_permissions_audit
 * avec source='migration:commercial-stock-view'.
 *
 * Usage :
 *   npx tsx scripts/database/apply-commercial-stock-view-permission.ts
 *   # ou
 *   npm run migrate:commercial-stock-view
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL non trouvée dans .env.local');
  process.exit(1);
}

const PERM_CODE = 'stock:view';
const ROLES_TO_GRANT = ['agent_commercial', 'commercial'];
const AUDIT_SOURCE = 'migration:commercial-stock-view';

async function main(): Promise<void> {
  console.log('Permission stock:view → rôles commerciaux');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // 1. Garantit que la permission existe (filet de sécurité : elle
    //    devrait déjà être insérée par sync-all-permissions).
    await pool.query(
      `INSERT INTO permissions (permission_id, code, name, module, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING`,
      [PERM_CODE, PERM_CODE, 'Voir le stock', 'stock', 'Consultation des stocks et des transferts entrants.']
    );

    const permR = await pool.query(`SELECT id FROM permissions WHERE code = $1`, [PERM_CODE]);
    if (permR.rowCount === 0) {
      throw new Error(`Permission ${PERM_CODE} introuvable après upsert`);
    }
    const permUuid = permR.rows[0].id;

    // 2. Vérifie présence de la table d'audit (créée par
    //    create-role-permissions-audit-table.ts). On audite uniquement
    //    si elle existe — le script reste utilisable sur les
    //    environnements pas encore migrés.
    const auditTable = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'role_permissions_audit'`
    );
    const hasAudit = (auditTable.rowCount ?? 0) > 0;
    if (!hasAudit) {
      console.log('Table role_permissions_audit absente — la trace d\'audit sera omise.');
    }

    let grants = 0;
    let skips = 0;
    let missing = 0;

    for (const roleCode of ROLES_TO_GRANT) {
      const role = await pool.query(
        `SELECT id FROM roles WHERE role_id = $1 LIMIT 1`,
        [roleCode]
      );
      if (role.rowCount === 0) {
        console.log(`  ${roleCode.padEnd(20)} rôle introuvable — passé`);
        missing++;
        continue;
      }
      const roleUuid = role.rows[0].id;

      const r = await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING role_id`,
        [roleUuid, permUuid]
      );

      if (r.rowCount && r.rowCount > 0) {
        console.log(`  ${roleCode.padEnd(20)} ← ${PERM_CODE}`);
        grants++;
        if (hasAudit) {
          await pool.query(
            `INSERT INTO role_permissions_audit (role_id, permission_id, action, changed_by, source)
             VALUES ($1, $2, 'GRANT', NULL, $3)`,
            [roleUuid, permUuid, AUDIT_SOURCE]
          );
        }
      } else {
        console.log(`  ${roleCode.padEnd(20)} déjà autorisé`);
        skips++;
      }
    }

    console.log(
      `\nRésumé : ${grants} attribution(s) créée(s), ${skips} déjà présente(s), ${missing} rôle(s) absent(s).`
    );
  } catch (e: any) {
    console.error('Erreur migration :', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
