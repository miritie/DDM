#!/usr/bin/env tsx
/**
 * Vérifie que la migration production v1 a bien été appliquée.
 * - Tables présentes
 * - Colonnes ajoutées sur ingredients / production_orders
 * - Enum production_order_status contient 'submitted'
 * - Catégorie achat_mp seedée
 * - Permissions et grants distribués
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });

const ok = (m: string) => console.log('✓', m);
const ko = (m: string) => { console.log('✗', m); process.exitCode = 1; };

async function main() {
  // 1. Tables nouvelles
  const newTables = ['purchase_request_lines', 'ingredient_receptions'];
  for (const t of newTables) {
    const r = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name=$1`, [t]);
    r.rowCount === 1 ? ok(`table ${t}`) : ko(`table ${t} MANQUANTE`);
  }

  // 2. Colonnes nouvelles
  const newCols: Array<[string, string]> = [
    ['ingredients', 'kind'],
    ['ingredients', 'recipe_id'],
    ['ingredients', 'preferred_supplier_account_id'],
    ['production_orders', 'customer_order_id'],
    ['production_orders', 'recipe_version'],
    ['production_orders', 'submitted_by_id'],
    ['production_orders', 'submitted_at'],
    ['production_orders', 'approved_by_id'],
    ['production_orders', 'approved_at'],
  ];
  for (const [t, c] of newCols) {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
      [t, c]
    );
    r.rowCount === 1 ? ok(`${t}.${c}`) : ko(`${t}.${c} MANQUANTE`);
  }

  // 3. Enum submitted
  const e = await pool.query(
    `SELECT 1 FROM pg_enum WHERE enumtypid='production_order_status'::regtype AND enumlabel='submitted'`
  );
  e.rowCount === 1 ? ok(`enum 'submitted'`) : ko(`enum submitted MANQUANT`);

  // 4. Catégorie achat_mp
  const c = await pool.query(`SELECT id, label FROM expense_categories WHERE code='achat_mp'`);
  c.rowCount! > 0 ? ok(`catégorie achat_mp seedée (${c.rowCount} ws)`) : ko(`catégorie achat_mp MANQUANTE`);

  // 5. Permissions
  const perms = [
    'production:submit','production:approve','production:view_cost',
    'ingredient:view','ingredient:edit',
    'recipe:view','recipe:edit','recipe:view_formula',
    'purchase_request:view','purchase_request:create','purchase_request:approve','purchase_request:receive',
  ];
  const p = await pool.query(`SELECT code FROM permissions WHERE code = ANY($1::text[])`, [perms]);
  p.rowCount === perms.length
    ? ok(`${perms.length} permissions enregistrées`)
    : ko(`permissions manquantes : ${perms.length - p.rowCount!}`);

  // 6. Grants par rôle
  for (const role of ['admin', 'pca', 'manager_production', 'manager_commercial', 'manager_compta_stocks']) {
    const g = await pool.query(
      `SELECT COUNT(*)::int AS n FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE r.role_id = $1 AND p.code = ANY($2::text[])`,
      [role, perms]
    );
    const n = g.rows[0].n;
    n > 0 ? ok(`role ${role.padEnd(24)} : ${n} grants`) : ko(`role ${role} : aucun grant`);
  }

  await pool.end();
  console.log('\nDone.');
}
main().catch((e) => { console.error('Erreur :', e); process.exit(1); });
