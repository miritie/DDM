#!/usr/bin/env tsx
/**
 * Seed des DONNÉES RÉELLES "Dune de Miel" (issues de l'OCR des 3 groupes WhatsApp).
 *
 * Source : scripts/data/real/*.json (construits par scripts/data/build-real-fixtures.py).
 *
 * Principe :
 *   - PRÉSERVE la structure de la démo (workspace, rôles, permissions, users staff).
 *   - UPSERT les référentiels réels : stands (outlets), produits, commerciaux/ouvriers
 *     (users + employees). Désactive les référentiels de démo non réels.
 *   - REMPLACE les transactions fictives : purge ventes/sessions/primes/observations/stock
 *     du workspace puis réinjecte l'historique réel (2025 → aujourd'hui).
 *   - IDEMPOTENT : ré-exécutable (business ids préfixés "WA-", purge avant ré-insertion).
 *
 * Lancement : DATABASE_URL=... npm run seed:real   (ou au déploiement)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

const DIR = path.join(__dirname, 'data', 'real');
const load = (name: string): any[] => JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf-8'));

const WORKSPACE_SLUG = 'dune-de-miel';
let SEQ = 0;
const bid = (p: string) => `WA-${p}-${(++SEQ).toString().padStart(6, '0')}`;

async function seed(client: import('pg').PoolClient) {
  // -- Workspace --
  const ws = (await client.query(`SELECT id FROM workspaces WHERE slug = $1`, [WORKSPACE_SLUG])).rows[0];
  if (!ws) throw new Error(`Workspace ${WORKSPACE_SLUG} introuvable — lancer le bootstrap d'abord.`);
  const wsId = ws.id;
  console.log(`Workspace: ${wsId}`);

  // -- Rôles -- (en prod les rôles portent des LIBELLÉS « Agent Commercial », pas les slugs)
  const roleId = async (candidates: string[]): Promise<string | null> =>
    (await client.query(
      `SELECT id FROM roles WHERE workspace_id = $1 AND name = ANY($2) LIMIT 1`,
      [wsId, candidates])).rows[0]?.id ?? null;
  const roleCommercial = await roleId(['agent_commercial', 'Agent Commercial']);
  const roleProduction = await roleId(['operateur_production', 'Opérateur Production', 'Operateur Production']);
  const fallbackRole = roleCommercial || (await client.query(
    `SELECT id FROM roles WHERE workspace_id = $1 ORDER BY created_at LIMIT 1`, [wsId])).rows[0]?.id;
  if (!fallbackRole) throw new Error('Aucun rôle dans le workspace.');

  // -- Tables optionnelles (auto-suffisance sur base fraîche) --
  await client.query(`
    CREATE TABLE IF NOT EXISTS commission_payouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payout_date DATE NOT NULL,
      outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
      seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind VARCHAR(20) NOT NULL DEFAULT 'prime',
      units INT NOT NULL DEFAULT 0,
      amount DECIMAL(15,2) NOT NULL,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (seller_user_id, outlet_id, payout_date, kind)
    )`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS outlet_daily_observations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
      observation_date DATE NOT NULL,
      observation TEXT NOT NULL,
      author_id UUID REFERENCES users(id) ON DELETE SET NULL,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (outlet_id, observation_date)
    )`);

  // ===================================================================== OUTLETS
  const outlets = load('outlets');
  const outletId = new Map<string, string>();
  for (const o of outlets) {
    const r = await client.query(
      `INSERT INTO outlets (code, name, city, workspace_id, is_active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (workspace_id, code) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, is_active = true
       RETURNING id`, [o.code, o.name, o.city, wsId]);
    outletId.set(o.code, r.rows[0].id);
  }
  // Désactiver les stands de démo non réels
  await client.query(
    `UPDATE outlets SET is_active = false WHERE workspace_id = $1 AND code <> ALL($2)`,
    [wsId, outlets.map((o) => o.code)]);
  console.log(`Outlets: ${outletId.size} réels (démo restants désactivés)`);

  // ===================================================================== PRODUCTS
  const products = load('products');
  const productId = new Map<string, string>();
  for (const p of products) {
    const r = await client.query(
      `INSERT INTO products (product_id, name, code, unit_price, category, unit, workspace_id, is_active)
       VALUES ($1,$2,$3,$4,$5,'piece',$6,true)
       ON CONFLICT (code, workspace_id) DO UPDATE SET name = EXCLUDED.name, unit_price = EXCLUDED.unit_price,
         category = EXCLUDED.category, is_active = true
       RETURNING id`, [`PROD-${p.code}`, p.name, p.code, p.unit_price, p.category, wsId]);
    productId.set(p.code, r.rows[0].id);
  }
  await client.query(
    `UPDATE products SET is_active = false WHERE workspace_id = $1 AND code <> ALL($2)`,
    [wsId, products.map((p) => p.code)]);
  console.log(`Products: ${productId.size} réels`);

  // ===================================================================== USERS + EMPLOYEES
  const people = load('people');
  const userId = new Map<string, string>(); // full_name -> user uuid
  for (const person of people) {
    const role = person.role === 'operateur_production' ? roleProduction : roleCommercial;
    const primaryRole = role || fallbackRole;
    const existing = await client.query(`SELECT id FROM users WHERE email = $1 OR username = $2`,
      [person.email, person.username]);
    let uid: string;
    if (existing.rows.length) {
      uid = existing.rows[0].id;
      await client.query(`UPDATE users SET full_name = $1, role_id = $2, workspace_id = $3, is_active = true WHERE id = $4`,
        [person.full_name, primaryRole, wsId, uid]);
    } else {
      const r = await client.query(
        `INSERT INTO users (user_id, username, email, full_name, display_name, role_id, workspace_id, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING id`,
        [bid('USR'), person.username, person.email, person.full_name,
         person.full_name.split(' ')[0], primaryRole, wsId]);
      uid = r.rows[0].id;
    }
    await client.query(
      `INSERT INTO user_roles (user_id, role_id, is_primary) VALUES ($1,$2,true)
       ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = true`, [uid, primaryRole]);
    userId.set(person.full_name, uid);

    // Employee miroir
    const [first, ...rest] = person.full_name.split(' ');
    const lastName = rest.join(' ') || first;
    await client.query(
      `INSERT INTO employees (employee_id, employee_code, first_name, last_name, full_name, phone,
         hire_date, position, contract_type, base_salary, status, workspace_id, user_id)
       VALUES ($1,$2,$3,$4,$5,'',$6,$7,$8,0,'active',$9,$10)
       ON CONFLICT (employee_code, workspace_id) DO UPDATE SET full_name = EXCLUDED.full_name,
         position = EXCLUDED.position, status = 'active', user_id = EXCLUDED.user_id`,
      [bid('EMP'), `WA-${person.username}`, first, lastName, person.full_name,
       person.hire_date || '2025-01-01', person.position, person.contract_type, wsId, uid]);
  }
  console.log(`Users+Employees: ${userId.size}`);

  // ===================================================================== PURGE TRANSACTIONS (remplacer démo)
  const before = (await client.query(`SELECT COUNT(*)::int n FROM sales WHERE workspace_id = $1`, [wsId])).rows[0].n;
  await client.query(`DELETE FROM sales WHERE workspace_id = $1`, [wsId]); // cascade sale_items
  await client.query(`DELETE FROM pos_sessions WHERE workspace_id = $1`, [wsId]);
  await client.query(`DELETE FROM commission_payouts WHERE workspace_id = $1`, [wsId]);
  await client.query(`DELETE FROM outlet_daily_observations WHERE workspace_id = $1`, [wsId]);
  await client.query(`DELETE FROM stock_items WHERE workspace_id = $1 AND outlet_id IS NOT NULL`, [wsId]);
  console.log(`Purge transactions de démo: ${before} ventes supprimées`);

  // ===================================================================== SALES + ITEMS + SESSIONS + PRIMES + OBS
  const sales = load('sales');

  // Vendeur par défaut par stand = commercial dominant des ventes nommées
  const dominant = new Map<string, Map<string, number>>();
  for (const s of sales) {
    if (!s.seller) continue;
    if (!dominant.has(s.outlet_code)) dominant.set(s.outlet_code, new Map());
    const m = dominant.get(s.outlet_code)!;
    m.set(s.seller, (m.get(s.seller) || 0) + 1);
  }
  const outletDefaultSeller = new Map<string, string>();
  for (const [oc, m] of dominant) {
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) outletDefaultSeller.set(oc, top);
  }
  const anyCommercial = people.find((p) => p.role === 'agent_commercial')?.full_name;

  const resolveSeller = (s: any): string => {
    const name = s.seller || outletDefaultSeller.get(s.outlet_code) || anyCommercial;
    return userId.get(name) || userId.get(anyCommercial!)!;
  };

  let nSales = 0, nItems = 0, nSessions = 0, nObs = 0;
  // Agrégation des primes par (user, outlet, date) pour respecter l'unicité
  const payouts = new Map<string, { date: string; outlet: string; user: string; amount: number; units: number }>();

  for (const s of sales) {
    const oId = outletId.get(s.outlet_code);
    if (!oId) continue;
    const sellerUid = resolveSeller(s);
    const total = Math.round(s.total_vente || s.items.reduce((a: number, it: any) => a + it.total, 0));
    const saleUuid = (await client.query(
      `INSERT INTO sales (sale_id, sale_number, total_amount, amount_paid, balance, status, payment_status,
         sale_date, sales_person_id, outlet_id, workspace_id, notes)
       VALUES ($1,$2,$3,$3,0,'fully_paid','fully_paid',$4,$5,$6,$7,$8) RETURNING id`,
      [bid('S'), `WA-${s.date}-${s.outlet_code}`, total, `${s.date}T12:00:00`,
       sellerUid, oId, wsId, `Journal réel — ${s.source_file}`])).rows[0].id;
    nSales++;
    for (const it of s.items) {
      const pId = it.product_code ? productId.get(it.product_code) : null;
      const pname = it.product_code
        ? (products.find((p) => p.code === it.product_code)?.name || it.product_code)
        : 'Vente non ventilée';
      // Contrainte BD : total_price = quantity × unit_price (exact). Le total caisse exact
      // reste porté par sales.total_amount.
      const qty = it.qty || 1;
      const unit = it.unit_price;
      await client.query(
        `INSERT INTO sale_items (sale_item_id, sale_id, product_id, product_name, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [bid('SI'), saleUuid, pId, pname, qty, unit, qty * unit]);
      nItems++;
    }
    // Session POS du jour (closing_cash_counted ajouté par migration runtime, non requis ici)
    await client.query(
      `INSERT INTO pos_sessions (outlet_id, user_id, started_at, ended_at, workspace_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [oId, sellerUid, `${s.date}T09:00:00`, `${s.date}T20:00:00`, wsId]);
    nSessions++;
    // Observation
    if (s.observation) {
      await client.query(
        `INSERT INTO outlet_daily_observations (outlet_id, observation_date, observation, author_id, workspace_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (outlet_id, observation_date) DO UPDATE SET observation = EXCLUDED.observation`,
        [oId, s.date, s.observation, sellerUid, wsId]);
      nObs++;
    }
    // Primes -> agrégation
    for (const pr of s.primes) {
      const u = userId.get(pr.commercial);
      if (!u) continue;
      const key = `${u}|${oId}|${s.date}`;
      const cur = payouts.get(key) || { date: s.date, outlet: oId, user: u, amount: 0, units: 0 };
      cur.amount += pr.amount; cur.units += 1;
      payouts.set(key, cur);
    }
  }

  // Insertion des primes agrégées
  let nPrimes = 0;
  for (const p of payouts.values()) {
    await client.query(
      `INSERT INTO commission_payouts (payout_date, outlet_id, seller_user_id, kind, units, amount, workspace_id)
       VALUES ($1,$2,$3,'prime',$4,$5,$6)
       ON CONFLICT (seller_user_id, outlet_id, payout_date, kind) DO UPDATE SET amount = EXCLUDED.amount, units = EXCLUDED.units`,
      [p.date, p.outlet, p.user, p.units, p.amount, wsId]);
    nPrimes++;
  }
  console.log(`Sales: ${nSales} · Items: ${nItems} · Sessions: ${nSessions} · Observations: ${nObs} · Primes: ${nPrimes}`);

  // ===================================================================== DÉPENSES (couche financière)
  // Chaîne du module Dépenses : expense_categories -> expense_requests(approved) -> expenses(paid).
  const cats = load('expense-categories');
  const catId = new Map<string, string>();
  for (const c of cats) {
    const r = await client.query(
      `INSERT INTO expense_categories (expense_category_id, label, code, workspace_id, is_active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (code, workspace_id) DO UPDATE SET label = EXCLUDED.label, is_active = true
       RETURNING id`, [`WA-CAT-${c.code}`, c.label, c.code, wsId]);
    catId.set(c.code, r.rows[0].id);
  }
  // Payeur/demandeur = un user encadrant (pca/admin/compta), sinon n'importe quel user staff
  const payer = (await client.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.workspace_id = $1 AND r.name IN ('pca','admin','manager_compta_stocks')
     ORDER BY CASE r.name WHEN 'manager_compta_stocks' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END LIMIT 1`,
    [wsId])).rows[0]?.id
    || (await client.query(`SELECT id FROM users WHERE workspace_id = $1 LIMIT 1`, [wsId])).rows[0]?.id;
  if (!payer) throw new Error('Aucun user pour porter les dépenses.');

  // Purge des dépenses de démo (expenses avant expense_requests pour la contrainte RESTRICT)
  await client.query(`DELETE FROM expenses WHERE workspace_id = $1`, [wsId]);
  await client.query(`DELETE FROM expense_requests WHERE workspace_id = $1`, [wsId]);

  const expenses = load('expenses');
  let nExp = 0;
  for (const e of expenses) {
    const cId = catId.get(e.category);
    if (!cId) continue;
    const reqUuid = (await client.query(
      `INSERT INTO expense_requests (expense_request_id, request_number, title, amount, category_id,
         requester_id, status, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,'approved',$7) RETURNING id`,
      [bid('ER'), `WA-DR-${e.date}-${nExp}`, e.title, e.amount, cId, payer, wsId])).rows[0].id;
    await client.query(
      `INSERT INTO expenses (expense_id, expense_number, expense_request_id, title, amount, category_id,
         payer_id, status, payment_date, payment_method, workspace_id, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'paid',$8,'historique',$9,$10)`,
      [bid('EXP'), `WA-DEP-${e.date}-${nExp}`, reqUuid, e.title, e.amount, cId, payer,
       `${e.date}T12:00:00`, wsId, `Dépense réelle (${e.origin}) — ${e.source_file}`]);
    nExp++;
  }
  console.log(`Dépenses: ${nExp} (${expenses.reduce((a: number, e: any) => a + e.amount, 0).toLocaleString('fr-FR')} F)`);

  // ===================================================================== STOCK
  const stock = load('stock');
  let nStock = 0;
  for (const st of stock) {
    const oId = outletId.get(st.outlet_code), pId = productId.get(st.product_code);
    if (!oId || !pId) continue;
    await client.query(
      `INSERT INTO stock_items (stock_item_id, product_id, outlet_id, quantity, workspace_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (product_id, outlet_id) WHERE outlet_id IS NOT NULL
       DO UPDATE SET quantity = EXCLUDED.quantity`,
      [bid('ST'), pId, oId, st.quantity, wsId]);
    nStock++;
  }
  console.log(`Stock: ${nStock} lignes`);

  // ===================================================================== MATIÈRES PREMIÈRES (ingredients)
  // Réutilise le modèle existant `ingredients` (kind=raw) — pas de nouvelle table.
  const rawMaterials = load('raw-materials');
  let nMat = 0;
  for (const m of rawMaterials) {
    await client.query(
      `INSERT INTO ingredients (ingredient_id, name, code, unit, unit_cost, minimum_stock, current_stock, workspace_id, is_active)
       VALUES ($1,$2,$3,$4,0,0,$5,$6,true)
       ON CONFLICT (code, workspace_id) DO UPDATE SET current_stock = EXCLUDED.current_stock,
         unit = EXCLUDED.unit, is_active = true`,
      [bid('ING'), m.name, m.code, m.unit, m.current_stock, wsId]);
    nMat++;
  }
  console.log(`Matières premières (ingredients): ${nMat}`);

  // ===================================================================== PRODUCTION (mouvements de stock)
  // Entrepôt usine + entrées de produits finis (stock_movements type 'entry').
  const whId = (await client.query(
    `INSERT INTO warehouses (warehouse_id, name, code, workspace_id, is_active)
     VALUES ($1,'Usine Dune de Miel','USINE-DDM',$2,true)
     ON CONFLICT (code, workspace_id) DO UPDATE SET is_active = true RETURNING id`,
    [bid('WH'), wsId])).rows[0].id;
  const prodUser = userId.get('Gervais') || payer;
  await client.query(`DELETE FROM stock_movements WHERE workspace_id = $1`, [wsId]);
  const production = load('production');
  let nProd = 0;
  for (const p of production) {
    const pId = productId.get(p.product_code);
    if (!pId) continue;
    await client.query(
      `INSERT INTO stock_movements (movement_id, movement_number, type, product_id,
         destination_warehouse_id, quantity, status, processed_by_id, processed_at, workspace_id)
       VALUES ($1,$2,'entry',$3,$4,$5,'validated',$6,$7,$8)`,
      [bid('MV'), `WA-PROD-${p.date}-${nProd}`, pId, whId, p.units, prodUser,
       `${p.date}T12:00:00`, wsId]);
    nProd++;
  }
  console.log(`Production (entrées stock): ${nProd}`);

  // Récap CA
  const ca = (await client.query(
    `SELECT COALESCE(SUM(total_amount),0)::float n FROM sales WHERE workspace_id = $1`, [wsId])).rows[0].n;
  console.log(`\n✅ Seed réel terminé. CA historique injecté: ${ca.toLocaleString('fr-FR')} F`);
}

// Atomique : tout réussit ou rien n'est appliqué (sécurité sur la prod).
async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seed(client);
    await client.query('COMMIT');
    console.log('✔ Transaction validée (COMMIT).');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('↩ Transaction annulée (ROLLBACK) — base inchangée.');
    throw e;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch((e) => { console.error('❌ Seed échoué:', e); pool.end(); process.exit(1); });
