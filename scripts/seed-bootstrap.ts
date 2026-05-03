#!/usr/bin/env tsx
/**
 * Bootstrap "Dune de Miel" - données métier réelles
 *
 *  Workspace : Dune de Miel
 *  Rôles    : PCA, Admin, Manager Commercial, Manager Compta&Stocks,
 *             Manager Production, Opérateur Production, Agent Commercial
 *  Users    : Bruno (PCA), Maxence (Admin), Romulus (M.Co), Ange (M.Co/St),
 *             Helene (M.Prod), Gervais (Op.Prod), Carine (Co), Anicet (Co)
 *  Outlets  : Playce Palmeraie, Playce Marcory (SUPERMARCHE)
 *             Pharmacie 8e Tranche, Pharmacie 2 Plateaux (PHARMACIE +20%)
 *             Hôtel Ivoire (HOTEL)
 *             Djibi (STAND_PROPRE)
 *  Produits : 9 produits avec prix de base
 *  Prix     : par type d'outlet (PHARMACIE = +20%, autres = base)
 *  Stock    : 30 unités initiales par (produit, outlet)
 *  Planning : Carine → Palmeraie, Anicet → Marcory (semaine en cours)
 *
 * À lancer après reset-and-rebuild.ts + seed-permissions.ts.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

// ---------------------------------------------------------------------------
// Configuration

const WORKSPACE = { slug: 'dune-de-miel', code: 'workspace_dune_miel', name: 'Dune de Miel' };

const ROLE_PERMISSIONS: Record<string, { name: string; permissions: string[] | 'ALL' }> = {
  pca: {
    name: 'Président (PCA)',
    permissions: 'ALL',
  },
  admin: {
    name: 'Administrateur Décideur',
    permissions: 'ALL',
  },
  manager_commercial: {
    name: 'Manager Commercial',
    permissions: [
      'sales:view', 'sales:create', 'sales:edit',
      'customer:view', 'customer:create', 'customer:edit',
      'loyalty:view', 'loyalty:manage', 'loyalty:redeem',
      'reports:view', 'reports:export',
      'hr:view', 'hr:commission',
      'outlet:view', 'outlet:edit', 'outlet:assign',
      'outlet:invoice:view', 'outlet:price:manage',
      'stock:view',
    ],
  },
  manager_compta_stocks: {
    name: 'Manager Comptabilité & Stocks',
    permissions: [
      'sales:view', 'stock:view', 'stock:create', 'stock:edit', 'stock:transfer',
      'treasury:view', 'treasury:create', 'treasury:edit', 'treasury:approve',
      'expense:view', 'expense:create', 'expense:edit', 'expense:pay',
      'reports:view', 'reports:export',
      'hr:view', 'hr:payroll',
      'outlet:view', 'outlet:invoice:view', 'outlet:invoice:manage',
    ],
  },
  manager_production: {
    name: 'Manager Production',
    permissions: [
      'production:view', 'production:create', 'production:edit',
      'production:start', 'production:complete',
      'stock:view', 'stock:create', 'stock:edit',
      'reports:view',
      'outlet:view',
    ],
  },
  operateur_production: {
    name: 'Opérateur Production',
    permissions: [
      'production:view',
      'stock:view',
    ],
  },
  agent_commercial: {
    name: 'Agent Commercial',
    permissions: [
      'sales:view', 'sales:create',
      'stock:view',
      'customer:view', 'customer:create', 'customer:edit',
      'loyalty:view', 'loyalty:redeem',
      'outlet:view', 'pos:session:open',
    ],
  },
};

const USERS = [
  { username: 'bruno',   email: 'bruno@dunedemiel.ci',   name: 'IRITIE Bruno',   password: 'pca123',         role: 'pca' },
  { username: 'maxence', email: 'maxence@dunedemiel.ci', name: 'IRITIE Maxence', password: 'admin123',       role: 'admin' },
  { username: 'romulus', email: 'romulus@dunedemiel.ci', name: 'IRITIE Romulus', password: 'mcom123',        role: 'manager_commercial' },
  { username: 'ange',    email: 'ange@dunedemiel.ci',    name: 'IRITIE Ange',    password: 'mcompta123',     role: 'manager_compta_stocks' },
  { username: 'helene',  email: 'helene@dunedemiel.ci',  name: 'IRITIE Helene',  password: 'mprod123',       role: 'manager_production' },
  { username: 'gervais', email: 'gervais@dunedemiel.ci', name: 'Gervais',        password: 'prod123',        role: 'operateur_production' },
  { username: 'carine',  email: 'carine@dunedemiel.ci',  name: 'DIE Carine',     password: 'commercial123',  role: 'agent_commercial' },
  { username: 'anicet',  email: 'anicet@dunedemiel.ci',  name: 'ANICET',         password: 'commercial123',  role: 'agent_commercial' },
];

const OUTLET_TYPES = [
  { code: 'SUPERMARCHE',   name: 'Supermarché',           description: 'Grandes surfaces (Playce, Carrefour…)' },
  { code: 'PHARMACIE',     name: 'Pharmacie',             description: 'Comptoirs hébergés en pharmacie' },
  { code: 'HOTEL',         name: 'Hôtel',                 description: 'Boutique en hôtel' },
  { code: 'STAND_PROPRE',  name: 'Stand propre',          description: 'Stand exploité en propre par DDM' },
];

const OUTLETS = [
  { code: 'PLAYCE-PALMERAIE',   name: 'Playce Palmeraie',         type: 'SUPERMARCHE',   city: 'Abidjan' },
  { code: 'PLAYCE-MARCORY',     name: 'Playce Marcory',           type: 'SUPERMARCHE',   city: 'Abidjan' },
  { code: 'PHARMA-8E',          name: 'Pharmacie 8ème Tranche',   type: 'PHARMACIE',     city: 'Abidjan' },
  { code: 'PHARMA-2PL',         name: 'Pharmacie des 2 Plateaux', type: 'PHARMACIE',     city: 'Abidjan' },
  { code: 'HOTEL-IVOIRE',       name: 'Hôtel Ivoire',             type: 'HOTEL',         city: 'Abidjan' },
  { code: 'DJIBI',              name: 'Stand Djibi',              type: 'STAND_PROPRE',  city: 'Abidjan' },
];

// Prix estimés à partir du journal (60.000 XOF total / journée)
const PRODUCTS = [
  { code: '7IEM',           name: '7ième',                  basePrice:  500, category: 'Bonbons' },
  { code: 'COMPLET-150G',   name: 'Complet 150g',           basePrice: 1000, category: 'Complets' },
  { code: 'COMPLET-300G',   name: 'Complet 300g',           basePrice: 2000, category: 'Complets' },
  { code: 'DELICES',        name: 'Délices',                basePrice: 1500, category: 'Délices' },
  { code: 'FEVES-PCOLA',    name: 'Fèves Petit Cola',       basePrice: 1000, category: 'Cola' },
  { code: 'AMANDE-BAOBAB',  name: 'Amande Baobab',          basePrice: 1500, category: 'Amandes' },
  { code: 'AMANDE-PCOLA',   name: 'Amande P. Cola',         basePrice: 1500, category: 'Amandes' },
  { code: 'AMANDE-BISSAP',  name: 'Amande Bissap',          basePrice: 1500, category: 'Amandes' },
  { code: 'BAOBAB',         name: 'Baobab',                 basePrice: 1500, category: 'Baobab' },
];

const PHARMACY_MARKUP = 1.20; // Pharmacies : +20% par rapport au prix de base

// Planning : commerciaux assignés aux outlets pour la semaine en cours (lundi → dimanche)
function thisWeekRange(): { start: string; end: string } {
  const today = new Date();
  const day = today.getDay() || 7; // 1=lundi … 7=dimanche
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

const ASSIGNMENTS = [
  { commercial: 'carine@dunedemiel.ci', outlet: 'PLAYCE-PALMERAIE' },
  { commercial: 'anicet@dunedemiel.ci', outlet: 'PLAYCE-MARCORY' },
];

// ---------------------------------------------------------------------------
// Helpers DB

async function ensureWorkspace(): Promise<string> {
  const r = await pool.query(`SELECT id FROM workspaces WHERE slug = $1`, [WORKSPACE.slug]);
  if (r.rows.length > 0) return r.rows[0].id;
  const created = await pool.query(
    `INSERT INTO workspaces (workspace_id, name, slug, description)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [WORKSPACE.code, WORKSPACE.name, WORKSPACE.slug, 'Production et vente de miel — Côte d\'Ivoire']
  );
  console.log('   ✅ workspace créé');
  return created.rows[0].id;
}

async function upsertRole(workspaceId: string, code: string, name: string): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM roles WHERE workspace_id = $1 AND name = $2`,
    [workspaceId, name]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const r = await pool.query(
    `INSERT INTO roles (role_id, name, description, workspace_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [code, name, name, workspaceId]
  );
  return r.rows[0].id;
}

async function attachPermissions(roleId: string, permissionCodes: string[] | 'ALL'): Promise<number> {
  const codesQuery = permissionCodes === 'ALL'
    ? await pool.query(`SELECT id FROM permissions`)
    : await pool.query(`SELECT id FROM permissions WHERE code = ANY($1)`, [permissionCodes]);

  let count = 0;
  for (const row of codesQuery.rows) {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [roleId, row.id]
    );
    count++;
  }
  return count;
}

async function upsertUser(
  workspaceId: string,
  username: string,
  email: string,
  name: string,
  passwordPlain: string,
  primaryRoleId: string,
  extraRoleIds: string[] = []
): Promise<string> {
  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const existing = await pool.query(`SELECT id FROM users WHERE email = $1 OR username = $2`, [email, username]);
  let userUuid: string;
  if (existing.rows.length > 0) {
    userUuid = existing.rows[0].id;
    await pool.query(
      `UPDATE users
       SET username = $1, password_hash = $2, full_name = $3, role_id = $4,
           workspace_id = $5, is_active = true
       WHERE id = $6`,
      [username, passwordHash, name, primaryRoleId, workspaceId, userUuid]
    );
  } else {
    const r = await pool.query(
      `INSERT INTO users
        (user_id, username, email, password_hash, full_name, display_name, role_id, workspace_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id`,
      [
        `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        username, email, passwordHash, name, name.split(' ')[0],
        primaryRoleId, workspaceId,
      ]
    );
    userUuid = r.rows[0].id;
  }
  // Rôle primaire
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id, is_primary)
     VALUES ($1, $2, true)
     ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = true`,
    [userUuid, primaryRoleId]
  );
  // Rôles secondaires (multi-profils)
  for (const extraRoleId of extraRoleIds) {
    if (extraRoleId === primaryRoleId) continue;
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id, is_primary)
       VALUES ($1, $2, false)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userUuid, extraRoleId]
    );
  }
  return userUuid;
}

async function upsertOutletType(workspaceId: string, code: string, name: string, description: string): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM outlet_types WHERE workspace_id = $1 AND code = $2`,
    [workspaceId, code]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const r = await pool.query(
    `INSERT INTO outlet_types (code, name, description, workspace_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [code, name, description, workspaceId]
  );
  return r.rows[0].id;
}

async function upsertOutlet(workspaceId: string, code: string, name: string, typeId: string, city: string): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM outlets WHERE workspace_id = $1 AND code = $2`,
    [workspaceId, code]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const r = await pool.query(
    `INSERT INTO outlets (code, name, outlet_type_id, city, workspace_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [code, name, typeId, city, workspaceId]
  );
  return r.rows[0].id;
}

async function upsertProduct(workspaceId: string, code: string, name: string, basePrice: number, category: string): Promise<string> {
  const existing = await pool.query(
    `SELECT id FROM products WHERE workspace_id = $1 AND code = $2`,
    [workspaceId, code]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const r = await pool.query(
    `INSERT INTO products (product_id, name, code, unit_price, category, unit, workspace_id)
     VALUES ($1, $2, $3, $4, $5, 'piece', $6) RETURNING id`,
    [`PROD-${code}`, name, code, basePrice, category, workspaceId]
  );
  return r.rows[0].id;
}

async function upsertOutletTypePrice(workspaceId: string, productId: string, outletTypeId: string, unitPrice: number): Promise<void> {
  // Pas de unicité native ; on évite les doublons en supprimant ceux qui se chevauchent
  await pool.query(
    `DELETE FROM outlet_prices
     WHERE workspace_id = $1 AND product_id = $2 AND outlet_type_id = $3 AND valid_to IS NULL`,
    [workspaceId, productId, outletTypeId]
  );
  await pool.query(
    `INSERT INTO outlet_prices (product_id, outlet_type_id, unit_price, workspace_id)
     VALUES ($1, $2, $3, $4)`,
    [productId, outletTypeId, unitPrice, workspaceId]
  );
}

async function ensureStockItem(workspaceId: string, productId: string, outletId: string, quantity: number, unitCost: number): Promise<void> {
  const existing = await pool.query(
    `SELECT id FROM stock_items WHERE product_id = $1 AND outlet_id = $2`,
    [productId, outletId]
  );
  if (existing.rows.length > 0) return;
  await pool.query(
    `INSERT INTO stock_items
      (stock_item_id, product_id, outlet_id, quantity, minimum_stock, unit_cost, total_value, workspace_id)
     VALUES ($1, $2, $3, $4, 5, $5, $6, $7)`,
    [
      `STK-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      productId, outletId, quantity, unitCost, quantity * unitCost, workspaceId,
    ]
  );
}

async function upsertAssignment(workspaceId: string, outletId: string, userId: string, weekStart: string, weekEnd: string, assignedById: string): Promise<void> {
  await pool.query(
    `INSERT INTO outlet_assignments
      (outlet_id, user_id, week_start, week_end, assigned_by_id, workspace_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (outlet_id, user_id, week_start) DO UPDATE
       SET week_end = EXCLUDED.week_end, assigned_by_id = EXCLUDED.assigned_by_id`,
    [outletId, userId, weekStart, weekEnd, assignedById, workspaceId]
  );
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  console.log('🌱 Bootstrap "Dune de Miel"\n');
  try {
    await pool.query('SELECT NOW()');

    console.log('1. Workspace');
    const workspaceId = await ensureWorkspace();

    console.log('2. Rôles + permissions');
    const roleIds: Record<string, string> = {};
    for (const code of Object.keys(ROLE_PERMISSIONS)) {
      const cfg = ROLE_PERMISSIONS[code];
      const roleId = await upsertRole(workspaceId, code, cfg.name);
      roleIds[code] = roleId;
      const n = await attachPermissions(roleId, cfg.permissions);
      console.log(`   ✅ ${cfg.name} : ${n} permissions`);
    }

    console.log('3. Utilisateurs');
    const userIds: Record<string, string> = {};
    const allRoleIds = Object.values(roleIds);
    for (const u of USERS) {
      // Maxence est multi-profils : il peut basculer sur tous les rôles
      const extras = u.username === 'maxence' ? allRoleIds : [];
      const uid = await upsertUser(workspaceId, u.username, u.email, u.name, u.password, roleIds[u.role], extras);
      userIds[u.email] = uid;
      const tag = extras.length ? ` [+${extras.length - 1} rôles secondaires]` : '';
      console.log(`   ✅ ${u.username.padEnd(10)} (${u.email.padEnd(28)}) ${ROLE_PERMISSIONS[u.role].name}${tag}`);
    }

    console.log('4. Types d\'outlets');
    const typeIds: Record<string, string> = {};
    for (const t of OUTLET_TYPES) {
      typeIds[t.code] = await upsertOutletType(workspaceId, t.code, t.name, t.description);
      console.log(`   ✅ ${t.name}`);
    }

    console.log('5. Outlets');
    const outletIds: Record<string, string> = {};
    for (const o of OUTLETS) {
      outletIds[o.code] = await upsertOutlet(workspaceId, o.code, o.name, typeIds[o.type], o.city);
      console.log(`   ✅ ${o.name.padEnd(30)} (${o.type})`);
    }

    console.log('6. Produits');
    const productIds: Record<string, string> = {};
    for (const p of PRODUCTS) {
      productIds[p.code] = await upsertProduct(workspaceId, p.code, p.name, p.basePrice, p.category);
      console.log(`   ✅ ${p.name.padEnd(25)} ${p.basePrice} XOF`);
    }

    console.log('7. Prix par type d\'outlet');
    for (const p of PRODUCTS) {
      for (const t of OUTLET_TYPES) {
        const price = t.code === 'PHARMACIE'
          ? Math.round((p.basePrice * PHARMACY_MARKUP) / 100) * 100
          : p.basePrice;
        await upsertOutletTypePrice(workspaceId, productIds[p.code], typeIds[t.code], price);
      }
    }
    console.log(`   ✅ ${PRODUCTS.length * OUTLET_TYPES.length} lignes de prix (PHARMACIE +${(PHARMACY_MARKUP - 1) * 100}%)`);

    console.log('8. Stock initial (30 unités par produit/outlet)');
    let stockCount = 0;
    for (const o of OUTLETS) {
      for (const p of PRODUCTS) {
        const cost = Math.round(p.basePrice / 2);
        await ensureStockItem(workspaceId, productIds[p.code], outletIds[o.code], 30, cost);
        stockCount++;
      }
    }
    console.log(`   ✅ ${stockCount} lignes de stock`);

    console.log('9. Planning commerciaux (semaine en cours)');
    const week = thisWeekRange();
    for (const a of ASSIGNMENTS) {
      await upsertAssignment(
        workspaceId,
        outletIds[a.outlet],
        userIds[a.commercial],
        week.start, week.end,
        userIds['romulus@dunedemiel.ci'],
      );
      console.log(`   ✅ ${a.commercial.split('@')[0]} → ${a.outlet} (${week.start} → ${week.end})`);
    }

    console.log('\n🎉 Bootstrap terminé.\n');
    console.log('📝 Comptes test (login = prénom OU email) :');
    USERS.forEach(u =>
      console.log(`   ${u.username.padEnd(10)} ${u.password.padEnd(15)} ${ROLE_PERMISSIONS[u.role].name}`)
    );
    console.log('\n📍 Outlets : ' + OUTLETS.map(o => o.name).join(', '));
    console.log('🛒 Produits : ' + PRODUCTS.map(p => p.name).join(', '));
    console.log('\n💡 Prix Pharmacie majorés de 20% par rapport au prix de base.');
  } catch (e: any) {
    console.error('❌', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
