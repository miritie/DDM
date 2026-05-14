#!/usr/bin/env tsx
/**
 * Crée et attribue les permissions du module Production v1 :
 *   - production:submit / approve / view_cost
 *   - ingredient:view / edit
 *   - recipe:view / edit / view_formula     ← view_formula = secret PCA + admin
 *   - purchase_request:view / create / approve / receive
 *
 * Idempotent. Modèle : apply-replenishments-permissions.ts.
 */
import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL non trouvée'); process.exit(1); }

const NEW_PERMS = [
  // Production étendue
  { code: 'production:submit',          name: 'Soumettre un ordre de production',          module: 'production' },
  { code: 'production:approve',         name: 'Approuver un ordre de production',          module: 'production' },
  { code: 'production:view_cost',       name: 'Voir le coût détaillé d\'un OP',            module: 'production' },

  // Matières premières & recettes
  { code: 'ingredient:view',            name: 'Voir les matières premières',                module: 'ingredient' },
  { code: 'ingredient:edit',            name: 'Créer / modifier une matière première',      module: 'ingredient' },
  { code: 'recipe:view',                name: 'Voir la liste des recettes',                 module: 'recipe' },
  { code: 'recipe:edit',                name: 'Créer / modifier une recette',               module: 'recipe' },
  { code: 'recipe:view_formula',        name: 'Voir la formule détaillée (% / marge)',      module: 'recipe' },

  // Sollicitations d'achat MP
  { code: 'purchase_request:view',      name: 'Voir les sollicitations d\'achat MP',        module: 'purchase_request' },
  { code: 'purchase_request:create',    name: 'Créer une sollicitation d\'achat MP',        module: 'purchase_request' },
  { code: 'purchase_request:approve',   name: 'Approuver une sollicitation d\'achat MP',    module: 'purchase_request' },
  { code: 'purchase_request:receive',   name: 'Enregistrer une réception MP',               module: 'purchase_request' },
];

const ROLES_TO_GRANT: Record<string, string[]> = {
  admin: [
    'production:submit', 'production:approve', 'production:view_cost',
    'ingredient:view', 'ingredient:edit',
    'recipe:view', 'recipe:edit', 'recipe:view_formula',
    'purchase_request:view', 'purchase_request:create', 'purchase_request:approve', 'purchase_request:receive',
  ],
  pca: [
    // PCA : visibilité totale incluant formule, mais pas d'opérationnel (pas de submit/approve)
    'production:view_cost',
    'ingredient:view', 'ingredient:edit',
    'recipe:view', 'recipe:edit', 'recipe:view_formula',
    'purchase_request:view',
  ],
  manager_production: [
    // Crée et lance les OP. Voit besoins MP par OP, PAS la formule détaillée.
    'production:submit',
    'ingredient:view',
    'recipe:view',
    'purchase_request:view', 'purchase_request:create', 'purchase_request:receive',
  ],
  manager_commercial: [
    // Voit liste recettes pour proposer une commande, sans formule.
    'recipe:view',
  ],
  manager_compta_stocks: [
    // Voit coûts pour compta, peut réceptionner et créer un PR si besoin.
    'production:view_cost',
    'ingredient:view',
    'recipe:view',
    'purchase_request:view', 'purchase_request:create', 'purchase_request:receive',
  ],
};

async function main() {
  console.log('🚀 Permissions PRODUCTION v1 (MP / recettes / achats MP)');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    // Création des permissions si absentes
    for (const p of NEW_PERMS) {
      await pool.query(
        `INSERT INTO permissions (permission_id, code, name, module, description)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING`,
        [p.code, p.code, p.name, p.module, p.name]
      );
    }
    console.log(`✅ ${NEW_PERMS.length} permissions garanties`);

    // Attribution aux rôles
    let grants = 0;
    let skips = 0;
    for (const [roleCode, perms] of Object.entries(ROLES_TO_GRANT)) {
      const role = await pool.query(`SELECT id FROM roles WHERE role_id = $1`, [roleCode]);
      if (role.rowCount === 0) {
        console.log(`⏭️  rôle ${roleCode} introuvable — passez la création du rôle d'abord`);
        continue;
      }
      const roleUuid = role.rows[0].id;
      for (const code of perms) {
        const perm = await pool.query(`SELECT id FROM permissions WHERE code = $1`, [code]);
        if (perm.rowCount === 0) continue;
        const r = await pool.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING role_id`,
          [roleUuid, perm.rows[0].id]
        );
        if (r.rowCount && r.rowCount > 0) {
          console.log(`✅ ${roleCode.padEnd(24)} ← ${code}`);
          grants++;
        } else {
          skips++;
        }
      }
    }
    console.log(`\n${grants} attribution(s) créée(s), ${skips} déjà présente(s).`);
  } catch (e: any) {
    console.error('❌', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
