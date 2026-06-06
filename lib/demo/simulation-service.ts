/**
 * Service - Simulation du jeu de données (démo / recette)
 *
 * ⚠️  DESTRUCTIF : purge les données OPÉRATIONNELLES (ventes, dépenses,
 *     trésorerie, écritures, production) puis simule l'activité depuis
 *     janvier 2020. Les référentiels (produits, stands, utilisateurs,
 *     plan comptable, catégories) sont conservés/complétés.
 *
 * Découpé en ÉTAPES pour tenir dans la durée max d'une fonction Vercel :
 *   1. simulatePrepare()      — référentiels + PURGE → liste des années
 *   2. simulateYearStep(year) — ventes/dépenses/production d'une année
 *   3. simulateFinalize()     — stocks finaux + résumé
 *
 * Utilisé par :
 *   - scripts/database/simulate-demo-data.ts  (CLI : npm run simulate:demo -- --yes)
 *   - app/api/admin/simulate-demo/route.ts    (en ligne, via /admin/simulate)
 *
 * Modèle économique : CA ~80 M FCFA/an jusqu'au COVID (mars 2020),
 * effondrement avril-juin 2020, reprise partielle S2 2020, puis ~60 M/an.
 * Saisonnalité (décembre fort), rythme hebdomadaire, aléa déterministe.
 */
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// RNG déterministe (mulberry32) — chaque étape est rejouable à l'identique
let rngState = 20200101;
const seedRng = (n: number) => { rngState = n; };
function rnd(): number {
  rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const SIMULATION_START_YEAR = 2020;
const FATOU_HIRED = '2021-03-01';

// ---------------------------------------------------------------------------
function makePool(): Pool {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) throw new Error('DATABASE_URL manquant');
  const useSsl = url.includes('sslmode=require') || url.includes('neon.tech');
  return new Pool({ connectionString: url, ssl: useSsl ? { rejectUnauthorized: false } : undefined, max: 3 });
}

async function bulkInsert(pool: Pool, table: string, columns: string[], rows: any[][], chunkSize = 200) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params: any[] = [];
    const values = chunk.map(r => `(${r.map(v => { params.push(v); return `$${params.length}`; }).join(',')})`);
    await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${values.join(',')}`, params);
  }
}

// ---------------------------------------------------------------------------
// Contexte partagé (idempotent) : référentiels chargés/complétés à chaque étape
interface SimContext {
  WS: string;
  outlets: Array<{ id: string; code: string; name: string }>;
  products: Array<{ id: string; name: string; code: string; price: number }>;
  ACC: Record<string, string | null>;
  U: Record<string, string>;
  walletByOutlet: Map<string, { id: string; accountId: string | null }>;
  bankW: { id: string; chart_account_id: string | null } | null;
  momoW: { id: string; chart_account_id: string | null } | null;
  bankAcc: string | null;
  momoAcc: string | null;
  J: Record<string, string>;
  CAT: Record<string, string>;
  CHARGE_ACC: Record<string, string | null>;
  ingMiel: string | null;
  ingPots: string | null;
  recipeId: string | null;
}

async function loadContext(pool: Pool): Promise<SimContext> {
  const wsR = await pool.query(`SELECT id FROM workspaces ORDER BY created_at LIMIT 1`);
  if (!wsR.rows[0]) throw new Error('Aucun workspace');
  const WS = wsR.rows[0].id;

  const outletsR = await pool.query(
    `SELECT id, code, name FROM outlets WHERE workspace_id = $1 AND is_active = true ORDER BY name`, [WS]);
  const outlets = outletsR.rows;
  if (outlets.length === 0) throw new Error('Aucun stand actif');

  const productsR = await pool.query(
    `SELECT id, name, code, unit_price::float AS price FROM products
     WHERE workspace_id = $1 AND is_active = true ORDER BY name`, [WS]);
  const products = productsR.rows.map((p: any, i: number) => ({
    ...p, price: p.price && p.price > 0 ? p.price : [500, 1000, 1500, 2000, 3000][i % 5],
  }));
  if (products.length === 0) throw new Error('Aucun produit actif');

  // Comptes SYSCOHADA essentiels — réutilise l'existant (par préfixe),
  // sinon CRÉE le compte (base vierge : plan comptable non initialisé).
  const ensureAccount = async (prefix: string, number: string, label: string, type: string, klass: string) => {
    const f = await pool.query(
      `SELECT id FROM chart_accounts WHERE workspace_id = $1 AND account_number LIKE $2 || '%'
       ORDER BY account_number LIMIT 1`, [WS, prefix]);
    if (f.rows[0]) return f.rows[0].id as string;
    return (await pool.query(
      `INSERT INTO chart_accounts (account_id, account_number, label, account_type, account_class, is_active, allow_direct_posting, workspace_id)
       VALUES ($1, $2, $3, $4::account_type, $5::account_class, true, true, $6)
       ON CONFLICT (account_number, workspace_id) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`,
      [`ACC-${number}-${WS.slice(0, 8)}`, number, label, type, klass, WS])).rows[0].id as string;
  };
  const ACC: Record<string, string | null> = {
    clients: await ensureAccount('411', '411', 'Clients', 'asset', 'class_4'),
    ventes: await ensureAccount('701', '701', 'Ventes de marchandises', 'revenue', 'class_7'),
    caisse: await ensureAccount('571', '571', 'Caisse', 'asset', 'class_5'),
    banque: await ensureAccount('521', '521', 'Banques', 'asset', 'class_5'),
    mp: await ensureAccount('601', '602', 'Achats de matières premières', 'expense', 'class_6'),
    salaires: await ensureAccount('66', '661', 'Rémunérations du personnel', 'expense', 'class_6'),
    loyer: await ensureAccount('622', '622', 'Locations', 'expense', 'class_6'),
    elec: await ensureAccount('605', '605', 'Eau et électricité', 'expense', 'class_6'),
    transport: await ensureAccount('61', '612', 'Transports', 'expense', 'class_6'),
    impots: await ensureAccount('64', '641', 'Impôts et taxes', 'expense', 'class_6'),
    divers: await ensureAccount('658', '658', 'Charges diverses', 'expense', 'class_6'),
  };

  // Utilisateurs : managers + commerciaux + FATOU
  const ensureUser = async (username: string, email: string, fullName: string, password: string, roleSlug: string) => {
    const roleR = await pool.query(`SELECT id FROM roles WHERE role_id = $1 AND workspace_id = $2 LIMIT 1`, [roleSlug, WS]);
    const roleId = roleR.rows[0]?.id;
    const exist = await pool.query(`SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1`, [username, email]);
    let uid = exist.rows[0]?.id;
    if (!uid) {
      const hash = await bcrypt.hash(password, 10);
      const ins = await pool.query(
        `INSERT INTO users (user_id, username, email, password_hash, full_name, display_name, role_id, workspace_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id`,
        [`USR-${username.toUpperCase()}`, username, email, hash, fullName, fullName.split(' ')[0], roleId, WS]);
      uid = ins.rows[0].id;
    }
    if (roleId) {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, is_primary) VALUES ($1, $2, true)
         ON CONFLICT (user_id, role_id) DO NOTHING`, [uid, roleId]);
    }
    return uid as string;
  };
  const U: Record<string, string> = {
    bruno: await ensureUser('bruno', 'bruno@dunedemiel.ci', 'IRITIE Bruno', 'pca123', 'pca'),
    maxence: await ensureUser('maxence', 'maxence@dunedemiel.ci', 'IRITIE Maxence', 'admin123', 'admin'),
    romulus: await ensureUser('romulus', 'romulus@dunedemiel.ci', 'IRITIE Romulus', 'mcom123', 'manager_commercial'),
    ange: await ensureUser('ange', 'ange@dunedemiel.ci', 'IRITIE Ange', 'mcompta123', 'manager_compta_stocks'),
    helene: await ensureUser('helene', 'helene@dunedemiel.ci', 'IRITIE Helene', 'mprod123', 'manager_production'),
    gervais: await ensureUser('gervais', 'gervais@dunedemiel.ci', 'Gervais', 'prod123', 'operateur_production'),
    carine: await ensureUser('carine', 'carine@dunedemiel.ci', 'DIE Carine', 'commercial123', 'agent_commercial'),
    anicet: await ensureUser('anicet', 'anicet@dunedemiel.ci', 'ANICET', 'commercial123', 'agent_commercial'),
    fatou: await ensureUser('fatou', 'fatou@dunedemiel.ci', 'KONE Fatou', 'commercial123', 'agent_commercial'),
  };

  // Structures attendues mais absentes d'une base jamais passée par les
  // scripts post-deploy (cas Vercel) : on les garantit ici, idempotent.
  await pool.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL`);
  await pool.query(`CREATE TABLE IF NOT EXISTS doc_counters (
    scope      VARCHAR(160) PRIMARY KEY,
    value      BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  const walletByOutlet = new Map<string, { id: string; accountId: string | null }>();
  for (const o of outlets) {
    let w = (await pool.query(
      `SELECT id, chart_account_id FROM wallets WHERE outlet_id = $1 AND type = 'cash' AND is_active = true LIMIT 1`, [o.id])).rows[0];
    if (!w) {
      w = (await pool.query(
        `SELECT id, chart_account_id FROM wallets WHERE workspace_id = $1 AND type = 'cash' AND is_active = true
           AND outlet_id IS NULL AND name ILIKE $2 LIMIT 1`, [WS, '%' + o.name + '%'])).rows[0];
      if (w) await pool.query(`UPDATE wallets SET outlet_id = $1 WHERE id = $2`, [o.id, w.id]);
    }
    if (!w) {
      w = (await pool.query(
        `INSERT INTO wallets (wallet_id, name, code, type, currency, balance, initial_balance, status, is_active, workspace_id, outlet_id, chart_account_id)
         VALUES ($1, $2, $3, 'cash', 'XOF', 0, 0, 'active', true, $4, $5, $6) RETURNING id, chart_account_id`,
        [randomUUID(), `Caisse ${o.name}`, `CASH-${o.code}`.slice(0, 30), WS, o.id, ACC.caisse])).rows[0];
    }
    if (!w.chart_account_id && ACC.caisse) {
      await pool.query(`UPDATE wallets SET chart_account_id = $1 WHERE id = $2`, [ACC.caisse, w.id]);
      w.chart_account_id = ACC.caisse;
    }
    walletByOutlet.set(o.id, { id: w.id, accountId: w.chart_account_id ?? ACC.caisse });
  }
  const bankW = (await pool.query(
    `SELECT id, chart_account_id FROM wallets WHERE workspace_id = $1 AND type = 'bank' AND is_active = true ORDER BY name LIMIT 1`, [WS])).rows[0] ?? null;
  const momoW = (await pool.query(
    `SELECT id, chart_account_id FROM wallets WHERE workspace_id = $1 AND type = 'mobile_money' AND is_active = true ORDER BY name LIMIT 1`, [WS])).rows[0] ?? null;

  // Journaux
  const ensureJournal = async (code: string, label: string, type: string) => {
    const f = await pool.query(`SELECT id FROM journals WHERE code = $1 AND workspace_id = $2 LIMIT 1`, [code, WS]);
    if (f.rows[0]) return f.rows[0].id as string;
    return (await pool.query(
      `INSERT INTO journals (journal_id, code, label, journal_type, is_active, workspace_id)
       VALUES ($1, $2, $3, $4, true, $5) RETURNING id`, [randomUUID(), code, label, type, WS])).rows[0].id as string;
  };
  const J: Record<string, string> = {
    VT: await ensureJournal('VT', 'Journal des ventes', 'sales'),
    CAI: await ensureJournal('CAI', 'Journal de caisse', 'cash'),
    BAN: await ensureJournal('BAN', 'Journal de banque', 'bank'),
    MM: await ensureJournal('MM', 'Journal mobile money', 'bank'),
  };

  // Catégories de dépenses
  const ensureCategory = async (match: string, label: string, code: string, chargeAcc: string | null) => {
    const f = await pool.query(
      `SELECT id FROM expense_categories WHERE workspace_id = $1 AND (label ILIKE $2 OR code ILIKE $2) LIMIT 1`,
      [WS, `%${match}%`]);
    if (f.rows[0]) return f.rows[0].id as string;
    return (await pool.query(
      `INSERT INTO expense_categories (expense_category_id, label, code, requires_pre_approval, is_active, workspace_id, charge_account_id)
       VALUES ($1, $2, $3, false, true, $4, $5) RETURNING id`,
      [randomUUID(), label, code, WS, chargeAcc])).rows[0].id as string;
  };
  const CAT: Record<string, string> = {
    mp: await ensureCategory('mati', 'Achats matières premières', 'ACHATS_MP', ACC.mp),
    salaires: await ensureCategory('salair', 'Salaires & personnel', 'SALAIRES', ACC.salaires),
    loyer: await ensureCategory('loyer', 'Loyers', 'LOYERS', ACC.loyer),
    elec: await ensureCategory('lectri', 'Électricité & eau', 'ENERGIE', ACC.elec),
    transport: await ensureCategory('transport', 'Transport', 'TRANSPORT', ACC.transport),
    impots: await ensureCategory('imp', 'Impôts & taxes', 'IMPOTS', ACC.impots),
    cnps: await ensureCategory('cnps', 'CNPS & ITS', 'CNPS_ITS', ACC.impots),
    divers: await ensureCategory('divers', 'Divers fonctionnement', 'DIVERS', ACC.divers),
  };
  const CHARGE_ACC: Record<string, string | null> = {
    [CAT.mp]: ACC.mp, [CAT.salaires]: ACC.salaires, [CAT.loyer]: ACC.loyer,
    [CAT.elec]: ACC.elec, [CAT.transport]: ACC.transport, [CAT.impots]: ACC.impots,
    [CAT.cnps]: ACC.impots, [CAT.divers]: ACC.divers,
  };

  // Ingrédients & recette (production)
  let ingMiel: string | null = null, ingPots: string | null = null, recipeId: string | null = null;
  try {
    const ensureIngredient = async (name: string, code: string, unit: string, unitCost: number) => {
      const f = await pool.query(`SELECT id FROM ingredients WHERE workspace_id = $1 AND (code = $2 OR name ILIKE $3) LIMIT 1`, [WS, code, name]);
      if (f.rows[0]) return f.rows[0].id as string;
      return (await pool.query(
        `INSERT INTO ingredients (ingredient_id, name, code, unit, unit_cost, currency, minimum_stock, current_stock, is_active, workspace_id)
         VALUES ($1, $2, $3, $4, $5, 'XOF', 50, 0, true, $6) RETURNING id`,
        [randomUUID(), name, code, unit, unitCost, WS])).rows[0].id as string;
    };
    ingMiel = await ensureIngredient('Miel brut', 'MIEL-BRUT', 'kg', 2000);
    ingPots = await ensureIngredient('Pots & emballages', 'EMBALLAGE', 'unité', 150);
    const recR = await pool.query(`SELECT id FROM recipes WHERE workspace_id = $1 AND is_active = true LIMIT 1`, [WS]);
    recipeId = recR.rows[0]?.id ?? (await pool.query(
      `INSERT INTO recipes (recipe_id, recipe_number, name, product_id, product_name, version, output_quantity, output_unit, is_active, workspace_id)
       VALUES ($1, 'REC-0001', 'Conditionnement miel', $2, $3, 1, 100, 'pots', true, $4) RETURNING id`,
      [randomUUID(), products[0].id, products[0].name, WS])).rows[0].id;
  } catch { /* module production optionnel */ }

  return {
    WS, outlets, products, ACC, U, walletByOutlet, bankW, momoW,
    bankAcc: bankW?.chart_account_id ?? ACC.banque,
    momoAcc: momoW?.chart_account_id ?? ACC.banque,
    J, CAT, CHARGE_ACC, ingMiel, ingPots, recipeId,
  };
}

// ---------------------------------------------------------------------------
// ÉTAPE 1 — Référentiels + PURGE
export interface PrepareResult {
  years: number[];
  outlets: number;
  products: number;
  warnings: string[];
}

export async function simulatePrepare(): Promise<PrepareResult> {
  const pool = makePool();
  try {
    seedRng(20200101);
    const ctx = await loadContext(pool);
    const warnings: string[] = [];
    if (!ctx.ACC.clients || !ctx.ACC.ventes) {
      warnings.push('Plan comptable non initialisé (411/701 absents) — écritures comptables sautées.');
    }

    // Employés (RH) — avant la purge, elle ne les touche pas
    let empSeq = 0;
    const ensureEmployee = async (userId: string | null, fullName: string, position: string, dept: string, salary: number, hire: string) => {
      const [first, ...rest] = fullName.split(' ');
      empSeq++;
      const exist = await pool.query(`SELECT id FROM employees WHERE full_name = $1 AND workspace_id = $2 LIMIT 1`, [fullName, ctx.WS]);
      if (exist.rows[0]) return;
      // employee_code unique : 'IRITIE Romulus/Ange/Helene' partagent le même
      // prénom de famille → suffixer par le rang pour éviter les collisions
      await pool.query(
        `INSERT INTO employees (employee_id, employee_code, first_name, last_name, full_name, phone, hire_date, department, position, contract_type, base_salary, currency, user_id, workspace_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'permanent', $10, 'XOF', $11, $12)
         ON CONFLICT DO NOTHING`,
        [randomUUID(), `EMP-${String(empSeq).padStart(2, '0')}-${(rest.join('') || first).toUpperCase().slice(0, 10)}`, rest.join(' ') || first, first, fullName,
         `+225 07 00 00 ${String(empSeq).padStart(2, '0')} ${String(empSeq * 11).padStart(2, '0')}`,
         hire, dept, position, salary, userId, ctx.WS]);
    };
    try {
      await ensureEmployee(ctx.U.romulus, 'IRITIE Romulus', 'Manager Commercial', 'Commercial', 350000, '2019-01-15');
      await ensureEmployee(ctx.U.ange, 'IRITIE Ange', 'Manager Comptabilité & Stocks', 'Finance', 350000, '2019-01-15');
      await ensureEmployee(ctx.U.helene, 'IRITIE Helene', 'Manager Production', 'Production', 350000, '2019-01-15');
      await ensureEmployee(ctx.U.gervais, 'Gervais', 'Opérateur Production', 'Production', 180000, '2019-06-01');
      await ensureEmployee(ctx.U.carine, 'DIE Carine', 'Agente Commerciale', 'Commercial', 150000, '2019-03-01');
      await ensureEmployee(ctx.U.anicet, 'ANICET', 'Agent Commercial', 'Commercial', 150000, '2019-09-01');
      await ensureEmployee(ctx.U.fatou, 'KONE Fatou', 'Agente Commerciale', 'Commercial', 150000, FATOU_HIRED);
    } catch (e: any) { warnings.push(`employees: ${e.message}`); }

    // PURGE des données opérationnelles
    for (const sql of [
      `DELETE FROM journal_entry_lines`,
      `DELETE FROM journal_entries`,
      `DELETE FROM transactions`,
      `DELETE FROM cash_deposits`,
      `DELETE FROM sale_payments`,
      `DELETE FROM sale_items`,
      `UPDATE sales SET pos_session_id = NULL`,
      `DELETE FROM pos_sessions`,
      `DELETE FROM sales`,
      `DELETE FROM expense_approval_steps`,
      `DELETE FROM expense_attachments`,
      `DELETE FROM expenses`,
      `DELETE FROM expense_requests`,
      `DELETE FROM ingredient_consumptions`,
      `DELETE FROM production_batches`,
      `DELETE FROM production_orders`,
      `DELETE FROM ingredient_receptions`,
      `DELETE FROM stock_movements`,
      `DELETE FROM stock_alerts`,
      `DELETE FROM doc_counters`,
    ]) {
      try { await pool.query(sql); } catch (e: any) {
        if (e.code !== '42P01') throw e; // table absente : on ignore
      }
    }
    await pool.query(`UPDATE wallets SET balance = 0 WHERE workspace_id = $1`, [ctx.WS]);

    const currentYear = new Date().getUTCFullYear();
    const years: number[] = [];
    for (let y = SIMULATION_START_YEAR; y <= currentYear; y++) years.push(y);
    return { years, outlets: ctx.outlets.length, products: ctx.products.length, warnings };
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// ÉTAPE 2 — Une année d'activité
export interface YearResult {
  year: number;
  sales: number;
  ca: number;
  entries: number;
  transactions: number;
  expenses: number;
}

export async function simulateYearStep(year: number): Promise<YearResult> {
  const pool = makePool();
  try {
    seedRng(20200101 + year);
    const ctx = await loadContext(pool);
    const { WS, outlets, products, ACC, U, walletByOutlet, bankW, momoW, bankAcc, momoAcc, J, CAT, CHARGE_ACC } = ctx;

    const sellersAt = (d: string) => d >= FATOU_HIRED
      ? [U.carine, U.anicet, U.fatou] : [U.carine, U.anicet];

    const paceFor = (d: Date): number => {
      const ym = d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
      if (ym < 202003) return 80_000_000;
      if (ym <= 202006) return 28_000_000;   // confinement
      if (ym <= 202012) return 52_000_000;   // reprise partielle
      return 60_000_000;
    };
    const SEASON = [0.90, 0.95, 1.00, 1.00, 1.05, 1.00, 0.95, 0.90, 1.00, 1.05, 1.10, 1.40];
    const WEEKDAY = [0.70, 0.95, 1.00, 1.00, 1.05, 1.25, 1.30]; // dim → sam

    // Soldes wallets : repartir des soldes laissés par l'année précédente
    const walletBal = new Map<string, number>();
    for (const r of (await pool.query(`SELECT id, balance::float AS b FROM wallets WHERE workspace_id = $1`, [WS])).rows) {
      walletBal.set(r.id, r.b || 0);
    }
    const bump = (wid: string, amt: number) => walletBal.set(wid, (walletBal.get(wid) || 0) + amt);

    // Accumulateurs bulk
    const salesRows: any[][] = [];
    const itemRows: any[][] = [];
    const payRows: any[][] = [];
    const txRows: any[][] = [];
    const entryRows: any[][] = [];
    const lineRows: any[][] = [];
    const reqRows: any[][] = [];
    const stepRows: any[][] = [];
    const expRows: any[][] = [];
    const recRows: any[][] = [];
    const opRows: any[][] = [];

    const counters = { sale: 0, pay: 0, inc: 0, exp: 0, trf: 0 };
    const jSeq = new Map<string, number>();
    const nextEntry = (journalId: string, code: string) => {
      const k = `${journalId}:${year}`;
      const n = (jSeq.get(k) || 0) + 1; jSeq.set(k, n);
      return `${code}-${year}-${String(n).padStart(4, '0')}`;
    };
    const pushEntry = (journalId: string, code: string, dateIso: string, desc: string, ref: string,
                       lines: Array<[string | null, string, number, number]>) => {
      if (!ACC.clients || !ACC.ventes) return;
      const usable = lines.filter(l => l[0]);
      if (usable.length < 2) return;
      const entryUuid = randomUUID();
      entryRows.push([
        entryUuid, `JE-${entryUuid.slice(0, 8)}`, nextEntry(journalId, code), journalId,
        dateIso, desc, ref, 'posted', dateIso + 'T18:00:00Z', year, Number(dateIso.slice(5, 7)), WS,
      ]);
      usable.forEach((l, i) => lineRows.push([
        `JEL-${randomUUID().slice(0, 8)}`, entryUuid, i + 1, l[0], l[1], l[2], l[3], ref,
      ]));
    };

    const today = new Date();
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Math.min(Date.UTC(year, 11, 31), Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));
    let yearCA = 0;
    let expCount = 0;

    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayIso = iso(d);
      const dailyTarget = paceFor(d) / 365 * SEASON[d.getUTCMonth()] * WEEKDAY[d.getUTCDay()];
      const sellers = sellersAt(dayIso);

      for (const o of outlets) {
        // part du stand ± aléa ; ~8 % de jours sans vente (stand fermé)
        if (rnd() < 0.08) continue;
        let target = dailyTarget / outlets.length * (0.65 + rnd() * 0.8);
        target = Math.max(2000, target);

        // Panier : 2-4 produits
        const nItems = rint(2, Math.min(4, products.length));
        const chosen = [...products].sort(() => rnd() - 0.5).slice(0, nItems);
        let total = 0;
        const items: Array<{ p: any; qty: number; lineTotal: number }> = [];
        for (const p of chosen) {
          const share = target / nItems;
          const qty = Math.max(1, Math.round(share / p.price));
          const lineTotal = qty * p.price;
          items.push({ p, qty, lineTotal });
          total += lineTotal;
        }

        counters.sale++;
        const saleNumber = `VT-${year}-${String(counters.sale).padStart(4, '0')}`;
        const saleUuid = randomUUID();
        const seller = pick(sellers);
        const hour = rint(9, 19);
        const ts = `${dayIso}T${String(hour).padStart(2, '0')}:${String(rint(0, 59)).padStart(2, '0')}:00Z`;

        salesRows.push([
          saleUuid, randomUUID(), saleNumber, total, total, 0, 'XOF', 'confirmed', 'fully_paid',
          ts, seller, o.id, WS, ts, ts,
        ]);
        for (const it of items) {
          itemRows.push([randomUUID(), saleUuid, it.p.id, it.p.name, it.qty, it.p.price, it.lineTotal, 'XOF']);
        }

        // Paiement : 88 % cash (caisse du stand), sinon mobile money
        const useMomo = momoW && rnd() < 0.12;
        const wallet = useMomo ? { id: momoW!.id, accountId: momoAcc } : walletByOutlet.get(o.id)!;
        counters.pay++;
        const payNumber = `PAY-${year}-${String(counters.pay).padStart(4, '0')}`;
        payRows.push([randomUUID(), saleUuid, payNumber, total, ts, wallet.id, seller, WS]);
        bump(wallet.id, total);

        counters.inc++;
        txRows.push([
          randomUUID(), `INC-${dayIso.slice(0, 7).replace('-', '')}-${String(counters.inc).padStart(4, '0')}`,
          'income', 'sale', total, null, wallet.id,
          `Encaissement vente ${saleNumber} — ${payNumber}`, saleNumber, 'completed', seller, ts, WS,
        ]);

        // Écritures : VT (411→701) + encaissement (5xx→411)
        pushEntry(J.VT, 'VT', dayIso, `Vente ${saleNumber} — client comptant`, saleNumber, [
          [ACC.clients, `Clients — vente ${saleNumber}`, total, 0],
          [ACC.ventes, `Ventes de marchandises — ${saleNumber}`, 0, total],
        ]);
        pushEntry(useMomo ? J.MM : J.CAI, useMomo ? 'MM' : 'CAI', dayIso,
          `Encaissement vente ${saleNumber} — ${payNumber}`, payNumber, [
            [wallet.accountId, `Encaissement ${saleNumber}`, total, 0],
            [ACC.clients, `Règlement client — ${saleNumber}`, 0, total],
          ]);

        yearCA += total;
      }

      // ===== Fin de mois : versements caisses → banque, dépenses, production =====
      const next = new Date(d); next.setUTCDate(next.getUTCDate() + 1);
      const isMonthEnd = next.getUTCMonth() !== d.getUTCMonth() || next > end;
      if (!isMonthEnd) continue;

      const month = d.getUTCMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      // a) Versements caisses → banque (laisser ~40 000 de fond de caisse)
      if (bankW) {
        for (const o of outlets) {
          const w = walletByOutlet.get(o.id)!;
          const bal = walletBal.get(w.id) || 0;
          if (bal > 60000) {
            const amt = Math.round((bal - 40000) / 1000) * 1000;
            counters.trf++;
            txRows.push([
              randomUUID(), `TRF-${monthKey.replace('-', '')}-${String(counters.trf).padStart(4, '0')}`,
              'transfer', 'transfer', amt, w.id, bankW.id,
              `Versement caisse ${o.name} — ${monthKey}`, `VERS-${monthKey}-${o.code}`, 'completed',
              U.ange, `${dayIso}T18:30:00Z`, WS,
            ]);
            bump(w.id, -amt); bump(bankW.id, amt);
          }
        }
      }

      // b) Dépenses du mois (payées par la banque)
      const caMonth = txRows
        .filter(t => t[2] === 'income' && String(t[11]).startsWith(monthKey))
        .reduce((s, t) => s + Number(t[4]), 0);
      const monthlyExpenses: Array<{ cat: string; label: string; amount: number }> = [
        { cat: CAT.mp, label: `Achat matières premières ${monthKey}`, amount: Math.round(caMonth * 0.45) },
        { cat: CAT.salaires, label: `Salaires ${monthKey}`, amount: 1_550_000 + (dayIso >= FATOU_HIRED ? 150000 : 0) },
        { cat: CAT.loyer, label: `Loyers stands ${monthKey}`, amount: 120000 * outlets.length },
        { cat: CAT.elec, label: `Électricité & eau ${monthKey}`, amount: rint(70, 110) * 1000 },
        { cat: CAT.transport, label: `Transport & livraisons ${monthKey}`, amount: rint(40, 80) * 1000 },
        { cat: CAT.cnps, label: `CNPS & ITS ${monthKey}`, amount: 240000 },
        { cat: CAT.divers, label: `Divers fonctionnement ${monthKey}`, amount: rint(25, 60) * 1000 },
        ...(month % 3 === 0 ? [{ cat: CAT.impots, label: `Impôts & taxes T${Math.ceil(month / 3)} ${year}`, amount: 460000 }] : []),
      ];

      for (const e of monthlyExpenses) {
        if (e.amount < 1000) continue;
        expCount++;
        const paidIso = `${monthKey}-${String(rint(10, 25)).padStart(2, '0')}`;
        const reqUuid = randomUUID();
        const expUuid = randomUUID();
        const expBiz = `DEP-${monthKey.replace('-', '')}-${String(expCount).padStart(3, '0')}`;
        reqRows.push([reqUuid, randomUUID(), `REQ-${expBiz}`, e.label, e.amount, e.cat, U.ange, 'approved', paidIso + 'T09:00:00Z', WS]);
        stepRows.push([randomUUID(), reqUuid, U.maxence, 1, 'approved', paidIso + 'T10:00:00Z']);
        // payment_method_id résolu à l'insertion (colonne enum legacy supprimée en 2c)
        expRows.push([expUuid, expBiz, expBiz, reqUuid, e.label, e.amount, e.cat, U.ange, 'paid', paidIso + 'T11:00:00Z', null, WS]);

        if (bankW) {
          counters.exp++;
          txRows.push([
            randomUUID(), `EXP-${monthKey.replace('-', '')}-${String(counters.exp).padStart(4, '0')}`,
            'expense', 'expense', e.amount, bankW.id, null,
            `Paiement dépense ${expBiz} — ${e.label}`, expBiz, 'completed', U.ange, paidIso + 'T11:00:00Z', WS,
          ]);
          bump(bankW.id, -e.amount);
          pushEntry(J.BAN, 'BAN', paidIso, `Paiement dépense ${expBiz} — ${e.label}`, expBiz, [
            [CHARGE_ACC[e.cat] || ACC.divers, e.label, e.amount, 0],
            [bankAcc, `Banque — paiement ${expBiz}`, 0, e.amount],
          ]);
        }
      }

      // c) Production mensuelle : réception MP + ordre terminé
      if (ctx.ingMiel && ctx.recipeId) {
        const kg = Math.max(20, Math.round(caMonth * 0.45 / 2000));
        recRows.push([
          randomUUID(), ctx.ingMiel, kg, 'kg', 2000, kg * 2000, U.helene, `${monthKey}-08T10:00:00Z`, 2000, 2000, 0, kg, WS,
        ]);
        const qty = kg * 2;
        opRows.push([
          randomUUID(), `OP-${monthKey.replace('-', '')}-001`, ctx.recipeId, 'Conditionnement miel', products[0].id, products[0].name,
          'completed', qty, qty, 'pots', `${monthKey}-10`, `${monthKey}-18`, `${monthKey}-10`, `${monthKey}-18`, U.gervais, 'Gervais', kg * 2000 + qty * 150, WS,
        ]);
      }
    }

    // ===== Insertion en masse =====
    await bulkInsert(pool, 'sales',
      ['id', 'sale_id', 'sale_number', 'total_amount', 'amount_paid', 'balance', 'currency', 'status', 'payment_status', 'sale_date', 'sales_person_id', 'outlet_id', 'workspace_id', 'created_at', 'updated_at'],
      salesRows);
    await bulkInsert(pool, 'sale_items',
      ['sale_item_id', 'sale_id', 'product_id', 'product_name', 'quantity', 'unit_price', 'total_price', 'currency'],
      itemRows);

    // payment_method_id : méthode cash/momo si dispo
    const pm = async (code: string) => (await pool.query(
      `SELECT id FROM payment_methods WHERE workspace_id = $1 AND code = $2 LIMIT 1`, [WS, code])).rows[0]?.id ?? null;
    const pmCash = await pm('cash'); const pmMomo = await pm('mobile_money');
    if (!pmCash) {
      throw new Error("Moyen de paiement 'cash' introuvable (table payment_methods) — configurer les moyens de paiement avant la simulation.");
    }
    const momoId = momoW?.id ?? null;
    await bulkInsert(pool, 'sale_payments',
      ['payment_id', 'sale_id', 'payment_number', 'amount', 'payment_date', 'wallet_id', 'received_by_id', 'workspace_id', 'payment_method_id'],
      payRows.map(r => [...r, (momoId && r[5] === momoId) ? (pmMomo ?? pmCash) : pmCash]));

    await bulkInsert(pool, 'transactions',
      ['transaction_id', 'transaction_number', 'type', 'category', 'amount', 'source_wallet_id', 'destination_wallet_id', 'description', 'reference', 'status', 'processed_by_id', 'processed_at', 'workspace_id'],
      txRows);

    if (entryRows.length) {
      await bulkInsert(pool, 'journal_entries',
        ['id', 'entry_id', 'entry_number', 'journal_id', 'entry_date', 'description', 'reference', 'status', 'posted_at', 'fiscal_year', 'fiscal_period', 'workspace_id'],
        entryRows);
      await bulkInsert(pool, 'journal_entry_lines',
        ['line_id', 'entry_id', 'line_number', 'account_id', 'label', 'debit_amount', 'credit_amount', 'reference'],
        lineRows);
    }

    await bulkInsert(pool, 'expense_requests',
      ['id', 'expense_request_id', 'request_number', 'title', 'amount', 'category_id', 'requester_id', 'status', 'submitted_at', 'workspace_id'],
      reqRows);
    await bulkInsert(pool, 'expense_approval_steps',
      ['approval_step_id', 'expense_request_id', 'approver_id', 'step_order', 'status', 'processed_at'],
      stepRows);
    const pmBank = await pm('bank_transfer');
    await bulkInsert(pool, 'expenses',
      ['id', 'expense_id', 'expense_number', 'expense_request_id', 'title', 'amount', 'category_id', 'payer_id', 'status', 'payment_date', 'payment_method_id', 'workspace_id'],
      expRows.map(r => { r[10] = pmBank ?? pmCash; return r; }));

    try {
      await bulkInsert(pool, 'ingredient_receptions',
        ['reception_id', 'ingredient_id', 'qty', 'unit', 'unit_price', 'total_cost', 'received_by_id', 'received_at', 'pmp_before', 'pmp_after', 'stock_before', 'stock_after', 'workspace_id'],
        recRows);
      await bulkInsert(pool, 'production_orders',
        ['production_order_id', 'order_number', 'recipe_id', 'recipe_name', 'product_id', 'product_name', 'status', 'planned_quantity', 'produced_quantity', 'unit', 'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'assigned_to_id', 'assigned_to_name', 'total_cost', 'workspace_id'],
        opRows);
    } catch { /* production optionnelle */ }

    // Soldes wallets + compteurs de l'année
    for (const [wid, bal] of walletBal) {
      await pool.query(`UPDATE wallets SET balance = $1 WHERE id = $2`, [Math.round(bal), wid]);
    }
    await pool.query(
      `INSERT INTO doc_counters (scope, value) VALUES ($1, $2)
       ON CONFLICT (scope) DO UPDATE SET value = EXCLUDED.value`, [`sales:${WS}:${year}`, counters.sale]);
    await pool.query(
      `INSERT INTO doc_counters (scope, value) VALUES ($1, $2)
       ON CONFLICT (scope) DO UPDATE SET value = EXCLUDED.value`, [`sale_payments:${WS}:${year}`, counters.pay]);

    return {
      year, sales: salesRows.length, ca: Math.round(yearCA),
      entries: entryRows.length, transactions: txRows.length, expenses: expRows.length,
    };
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// ÉTAPE 3 — Stocks finaux + résumé
export interface FinalizeResult {
  stockItems: number;
  summary: Array<{ year: number; ca: number; sales: number }>;
  entries: number;
  transactions: number;
}

export async function simulateFinalize(): Promise<FinalizeResult> {
  const pool = makePool();
  try {
    seedRng(20991231);
    const ctx = await loadContext(pool);
    const { WS, outlets, products } = ctx;

    await pool.query(`DELETE FROM stock_items WHERE workspace_id = $1`, [WS]);
    const wh = (await pool.query(`SELECT id FROM warehouses WHERE workspace_id = $1 ORDER BY created_at LIMIT 1`, [WS])).rows[0];
    const stockRows: any[][] = [];
    for (const p of products) {
      const cost = Math.round(p.price * 0.5);
      if (wh) stockRows.push([randomUUID(), p.id, wh.id, null, rint(80, 400), 20, null, cost, 0, WS]);
      for (const o of outlets) {
        const qty = rnd() < 0.12 ? 0 : rint(3, 45); // quelques ruptures réalistes
        stockRows.push([randomUUID(), p.id, null, o.id, qty, 5, null, cost, qty * cost, WS]);
      }
    }
    await bulkInsert(pool, 'stock_items',
      ['stock_item_id', 'product_id', 'warehouse_id', 'outlet_id', 'quantity', 'minimum_stock', 'maximum_stock', 'unit_cost', 'total_value', 'workspace_id'],
      stockRows.map(r => { r[8] = Number(r[4]) * Number(r[7]); return r; }));

    const sumR = await pool.query(
      `SELECT EXTRACT(YEAR FROM sale_date)::int AS year, SUM(total_amount)::float AS ca, COUNT(*)::int AS sales
       FROM sales WHERE workspace_id = $1 GROUP BY 1 ORDER BY 1`, [WS]);
    const entries = (await pool.query(`SELECT COUNT(*)::int AS n FROM journal_entries WHERE workspace_id = $1`, [WS])).rows[0].n;
    const transactions = (await pool.query(`SELECT COUNT(*)::int AS n FROM transactions WHERE workspace_id = $1`, [WS])).rows[0].n;

    return {
      stockItems: stockRows.length,
      summary: sumR.rows.map((r: any) => ({ year: r.year, ca: Math.round(r.ca), sales: r.sales })),
      entries, transactions,
    };
  } finally {
    await pool.end();
  }
}
