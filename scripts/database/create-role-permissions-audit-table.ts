#!/usr/bin/env tsx
/**
 * Crée la table `role_permissions_audit` qui journalise chaque
 * attribution / retrait de permission sur un rôle.
 *
 * Pourquoi
 *   La table `role_permissions` ne porte pas d'historique : on ne peut
 *   pas savoir qui a retiré une permission, ni quand. Or l'opération
 *   d'édition (`assignPermissions`) fait un DELETE complet puis un
 *   INSERT — une perte silencieuse est très facile à provoquer.
 *
 *   Cette table garde la trace de :
 *     - action (GRANT / REVOKE)
 *     - rôle et permission concernés (UUIDs)
 *     - user qui a fait l'action (NULL si script)
 *     - timestamp
 *     - source (label libre : 'admin-ui' | 'script:<nom>' | 'seed' …)
 *
 *   Pas de FK strictes vers permissions/roles : on veut conserver
 *   l'historique même si la perm ou le rôle est supprimé plus tard.
 *
 * Idempotent — réexécutable sans danger (IF NOT EXISTS).
 */
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL non trouvée'); process.exit(1); }

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS role_permissions_audit (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id       uuid NOT NULL,
        permission_id uuid NOT NULL,
        action        varchar(10) NOT NULL CHECK (action IN ('GRANT', 'REVOKE')),
        changed_by    uuid,
        source        varchar(80),
        changed_at    timestamp without time zone NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_rpa_role  ON role_permissions_audit (role_id, changed_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_rpa_perm  ON role_permissions_audit (permission_id, changed_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_rpa_user  ON role_permissions_audit (changed_by, changed_at DESC) WHERE changed_by IS NOT NULL`);

    const n = await pool.query(`SELECT COUNT(*)::int AS n FROM role_permissions_audit`);
    console.log(`✅ Table role_permissions_audit prête (${n.rows[0].n} entrées existantes).`);
  } catch (e: any) {
    console.error('❌', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
