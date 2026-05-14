#!/usr/bin/env tsx
/**
 * Grant treasury:view (et payment_method:view) au manager_commercial.
 *
 * Le manager commercial doit pouvoir lister les wallets et les moyens
 * de paiement pour saisir une avance dans une commande négociée.
 * Sans treasury:view, /api/treasury/wallets retourne 403 et la page
 * /orders/new ne peut pas afficher le sélecteur d'avance.
 *
 * Idempotent.
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL'); process.exit(1); }

const GRANTS: Record<string, string[]> = {
  manager_commercial: ['treasury:view', 'payment_method:view'],
};

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    let grants = 0;
    for (const [roleCode, perms] of Object.entries(GRANTS)) {
      const role = await pool.query(`SELECT id FROM roles WHERE role_id = $1`, [roleCode]);
      if (role.rowCount === 0) { console.log(`⏭️ ${roleCode} introuvable`); continue; }
      for (const code of perms) {
        const perm = await pool.query(`SELECT id FROM permissions WHERE code = $1`, [code]);
        if (perm.rowCount === 0) { console.log(`⏭️ permission ${code} introuvable`); continue; }
        const r = await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING role_id`,
          [role.rows[0].id, perm.rows[0].id]
        );
        if (r.rowCount && r.rowCount > 0) {
          console.log(`✅ ${roleCode} ← ${code}`);
          grants++;
        } else {
          console.log(`⏭️ ${roleCode} a déjà ${code}`);
        }
      }
    }
    console.log(`\n${grants} attribution(s) créée(s)`);
  } catch (e: any) { console.error('❌', e.message); process.exit(1); }
  finally { await pool.end(); }
}
main();
