#!/usr/bin/env tsx
/**
 * Crée la permission `ingredient:inventory` (comptage physique +
 * ajustement de stock) et l'attribue à admin, manager_compta_stocks et
 * manager_production.
 *
 * Pourquoi cette permission séparée ?
 *
 *   Avant ce script, l'inventaire physique (compter le stock réel,
 *   enregistrer un ajustement) était gardé par `ingredient:edit` — la
 *   même permission qui autorise à modifier la FICHE d'une MP (nom,
 *   fournisseur, prix de référence). Conséquence : seuls admin et PCA
 *   pouvaient inventorier, alors que ce sont les rôles terrain
 *   (manager_compta_stocks, manager_production) qui font ce travail.
 *
 *   On sépare donc :
 *     - ingredient:edit       → admin + pca (fiche, prix réf., métier)
 *     - ingredient:inventory  → admin + compta_stocks + production
 *
 * Idempotent — réexécutable sans danger.
 */
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL non trouvée'); process.exit(1); }

const PERM = {
  code: 'ingredient:inventory',
  name: 'Inventorier / ajuster le stock physique d\'une matière première',
  module: 'ingredient',
  description:
    'Permet le comptage physique et l\'enregistrement d\'un ajustement de stock. ' +
    'Distinct de ingredient:edit (fiche MP, prix de référence). Destiné aux ' +
    'rôles opérationnels terrain.',
};

const ROLES_TO_GRANT = ['admin', 'manager_compta_stocks', 'manager_production'];

async function main() {
  console.log('🚀 Permission ingredient:inventory + attribution aux rôles terrain');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // 1. Création de la permission si absente
    await pool.query(
      `INSERT INTO permissions (permission_id, code, name, module, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO NOTHING`,
      [PERM.code, PERM.code, PERM.name, PERM.module, PERM.description]
    );
    console.log(`✅ Permission ${PERM.code} garantie en DB`);

    // 2. Récupère l'UUID de la permission
    const permR = await pool.query(`SELECT id FROM permissions WHERE code = $1`, [PERM.code]);
    if (permR.rowCount === 0) {
      throw new Error('Permission ingredient:inventory introuvable après insertion');
    }
    const permUuid = permR.rows[0].id;

    // 3. Attribution aux rôles
    let grants = 0;
    let skips = 0;
    let missing = 0;
    for (const roleCode of ROLES_TO_GRANT) {
      const role = await pool.query(`SELECT id FROM roles WHERE role_id = $1`, [roleCode]);
      if (role.rowCount === 0) {
        console.log(`⏭️  rôle ${roleCode} introuvable — passé`);
        missing++;
        continue;
      }
      const r = await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING role_id`,
        [role.rows[0].id, permUuid]
      );
      if (r.rowCount && r.rowCount > 0) {
        console.log(`✅ ${roleCode.padEnd(24)} ← ingredient:inventory`);
        grants++;
      } else {
        console.log(`↪️  ${roleCode.padEnd(24)} déjà autorisé`);
        skips++;
      }
    }
    console.log(
      `\n${grants} attribution(s) créée(s), ${skips} déjà présente(s), ${missing} rôle(s) absent(s).`
    );
  } catch (e: any) {
    console.error('❌', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
