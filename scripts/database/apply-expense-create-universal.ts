#!/usr/bin/env tsx
/**
 * Rend la sollicitation de dépense accessible à tous les rôles métier :
 *  - grant expense:view + expense:create aux rôles qui ne l'ont pas
 *  - restreint quelques catégories sensibles à admin/pca/manager_compta_stocks
 *    via allowed_role_ids (les autres restent NULL = accessibles à tous)
 *
 * Idempotent.
 */
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

const ROLES_TO_GRANT = [
  'agent_commercial',
  'manager_commercial',
  'manager_production',
  'operateur_production',
];
const PERMS = ['expense:view', 'expense:create'];

const RESTRICTED_CATEGORIES = [
  'salaires_charges',
  'fiscalite',
  'frais_compta',
  'obligations_administratives',
];
const RESTRICTED_TO_ROLES = ['admin', 'pca', 'manager_compta_stocks'];

(async () => {
  console.log('🚀 Universal expense:create + restrictions par catégorie\n');

  // 1. Permissions
  let grants = 0, skips = 0;
  for (const role of ROLES_TO_GRANT) {
    const roleR = await pool.query(`SELECT id FROM roles WHERE role_id = $1`, [role]);
    if (roleR.rowCount === 0) { console.log(`⏭  ${role} introuvable`); continue; }
    const roleUuid = roleR.rows[0].id;
    for (const perm of PERMS) {
      const pR = await pool.query(`SELECT id FROM permissions WHERE code = $1`, [perm]);
      if (pR.rowCount === 0) continue;
      const r = await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING role_id`,
        [roleUuid, pR.rows[0].id]
      );
      if (r.rowCount && r.rowCount > 0) {
        console.log(`✅ ${role.padEnd(24)} ← ${perm}`);
        grants++;
      } else { skips++; }
    }
  }
  console.log(`\n${grants} grant(s) créés, ${skips} déjà présents.\n`);

  // 2. Catégories sensibles → restreint via allowed_role_ids sur les types
  const wsR = await pool.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`);
  const wsUuid = wsR.rows[0].id;

  const rolesR = await pool.query(
    `SELECT id, role_id FROM roles WHERE role_id = ANY($1::text[])`,
    [RESTRICTED_TO_ROLES]
  );
  const restrictedRoleUuids = rolesR.rows.map((r: any) => r.id);

  if (restrictedRoleUuids.length === 0) {
    console.log('⚠ Aucun rôle restreint trouvé. Skip.');
    await pool.end();
    return;
  }

  console.log(`Catégories sensibles → restreintes à : ${RESTRICTED_TO_ROLES.join(', ')}`);

  for (const catCode of RESTRICTED_CATEGORIES) {
    const catR = await pool.query(
      `SELECT id, label FROM expense_categories WHERE code = $1 AND workspace_id = $2`,
      [catCode, wsUuid]
    );
    if (catR.rowCount === 0) { console.log(`  ⏭  catégorie ${catCode} introuvable`); continue; }
    const catUuid = catR.rows[0].id;
    const catLabel = catR.rows[0].label;

    // Update tous les types de cette catégorie qui n'ont pas déjà des restrictions
    // (idempotent : on ne touche pas si déjà restreint manuellement à un sous-ensemble)
    const upd = await pool.query(
      `UPDATE expense_types
       SET allowed_role_ids = $1::uuid[], updated_at = CURRENT_TIMESTAMP
       WHERE category_id = $2
         AND (allowed_role_ids IS NULL OR allowed_role_ids = '{}'::uuid[])
       RETURNING code`,
      [restrictedRoleUuids, catUuid]
    );
    console.log(`  ✓ ${catCode.padEnd(30)} ${catLabel.padEnd(35)} → ${upd.rowCount} type(s) restreint(s)`);
  }

  await pool.end();
  console.log('\n✅ Terminé.');
})();
