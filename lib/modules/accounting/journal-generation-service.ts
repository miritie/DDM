/**
 * Service — Génération automatique d'écritures comptables
 *
 * À chaque paiement de dépense exécuté depuis un ou plusieurs wallets, génère
 * automatiquement l'écriture comptable correspondante :
 *
 *   Débit : 6xxx (compte de charge de la catégorie)       montant HT
 *   Débit : 4456x (TVA déductible)                         montant TVA   [si TVA applicable]
 *   Crédit : 5xx (compte de trésorerie pour CHAQUE wallet) montant débourcé
 *
 * Toujours équilibrée par construction : Σdébit = HT + TVA = TTC = Σcrédit.
 *
 * Convention TTC : le montant saisi dans expense.amount est considéré
 * comme TTC. Le HT et la TVA sont calculés à partir du tva_rate de la
 * catégorie. Si tva_rate = 0 ou pas de tva_account_id, pas de ligne TVA.
 *
 * Choix du journal : selon le type dominant des wallets utilisés (cash → CAI,
 * bank → BAN, mobile_money → MM). Fallback : OD (Opérations diverses).
 *
 * Le tout en transaction SQL pour atomicité. Si quelque chose pète, aucune
 * écriture n'est posée.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();

const JOURNAL_CODE_BY_WALLET_TYPE: Record<string, string> = {
  cash: 'CAI',
  bank: 'BAN',
  mobile_money: 'MM',
};

export class JournalGenerationService {
  /**
   * Génère l'écriture comptable pour le paiement d'une dépense.
   * Retourne l'UUID de l'écriture créée (ou throw en cas d'erreur).
   *
   * Idempotent : si une écriture existe déjà pour cette expense, la retourne
   * sans rien créer. Évite les doublons en cas de relance du paiement.
   */
  async fromExpensePayment(expenseId: string): Promise<string> {
    // 0. Idempotence : si une écriture existe déjà, on la renvoie
    const existing = await db.query<any>(
      `SELECT id FROM journal_entries WHERE expense_id = $1 LIMIT 1`,
      [expenseId]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    // 1. Charger expense + résolution du mapping comptable
    //    Cascade : type.charge_account_id (si renseigné) > catégorie.charge_account_id
    //    Idem pour TVA et tva_rate. Permet d'utiliser un compte spécifique
    //    par type de dépense (ex: 6022 pour MP hors région) sans toucher
    //    à la catégorie globale.
    const expR = await db.query<any>(
      `SELECT e.id, e.expense_id, e.expense_number, e.title, e.amount,
              e.status, e.workspace_id, e.payment_date,
              ec.code AS category_code, ec.label AS category_label,
              et.label AS type_label,
              COALESCE(et.charge_account_id, ec.charge_account_id) AS charge_account_id,
              COALESCE(et.tva_account_id,    ec.tva_account_id)    AS tva_account_id,
              COALESCE(et.tva_rate,          ec.tva_rate)           AS tva_rate
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       LEFT JOIN expense_types et      ON et.id = e.expense_type_id
       WHERE e.id = $1 LIMIT 1`,
      [expenseId]
    );
    if (expR.rows.length === 0) throw new Error('Dépense introuvable pour génération comptable');
    const exp = expR.rows[0];

    if (exp.status !== 'paid') {
      throw new Error(`Génération comptable impossible : statut '${exp.status}', attendu 'paid'`);
    }
    if (!exp.charge_account_id) {
      const target = exp.type_label ? `type '${exp.type_label}'` : `catégorie '${exp.category_code}'`;
      throw new Error(`${target} sans compte de charge configuré — impossible de générer l'écriture.`);
    }

    // 2. Charger les transactions de paiement + wallets associés
    const txR = await db.query<any>(
      `SELECT t.id, t.amount, t.source_wallet_id,
              w.type AS wallet_type, w.name AS wallet_name, w.chart_account_id AS wallet_account_id
       FROM transactions t
       LEFT JOIN wallets w ON w.id = t.source_wallet_id
       WHERE t.expense_id = $1
       ORDER BY t.processed_at ASC`,
      [expenseId]
    );
    if (txR.rows.length === 0) {
      throw new Error('Aucune transaction wallet liée à cette dépense — paiement incomplet.');
    }

    // 3. Toutes les transactions doivent avoir un wallet avec compte mappé
    for (const tx of txR.rows) {
      if (!tx.wallet_account_id) {
        throw new Error(`Wallet "${tx.wallet_name}" sans compte comptable configuré (chart_account_id).`);
      }
    }

    // 3 bis. EXTINCTION DE DETTE FOURNISSEUR.
    // Si la dépense a été ENGAGÉE à l'approbation (écriture D 6xx / C 401
    // déjà passée, réf ENG-…), alors le paiement n'est plus une charge :
    // c'est l'extinction de la dette → Débit 401 Fournisseurs / Crédit 5xx.
    // Sinon (dépenses historiques sans engagement), comportement INCHANGÉ.
    const engaged = await db.query<any>(
      `SELECT id FROM journal_entries
       WHERE workspace_id = $1 AND reference = $2 LIMIT 1`,
      [exp.workspace_id, `ENG-${exp.expense_number}`]
    );
    if (engaged.rows[0]) {
      await this.ensureCoreAccounts(exp.workspace_id);
      const supplier = (await this.findAccount(exp.workspace_id, '401'))
        ?? (await this.findAccount(exp.workspace_id, '40'));
      if (!supplier) throw new Error('Compte fournisseurs (401) introuvable au plan comptable');

      const totalsByTypeE: Record<string, number> = {};
      for (const tx of txR.rows) {
        const t = tx.wallet_type || 'other';
        totalsByTypeE[t] = (totalsByTypeE[t] || 0) + Number(tx.amount);
      }
      const domE = Object.entries(totalsByTypeE).sort((a, b) => b[1] - a[1])[0]?.[0];
      const journal = await this.ensureJournal(
        exp.workspace_id, JOURNAL_CODE_BY_WALLET_TYPE[domE] || 'OD',
        'Journal de trésorerie', 'bank'
      );
      const totalTtc = txR.rows.reduce((s: number, tx: any) => s + Number(tx.amount), 0);
      const lines = [
        { accountId: supplier.id, label: `Règlement fournisseur — ${exp.expense_number}`, debit: totalTtc, credit: 0 },
        ...txR.rows.map((tx: any) => ({
          accountId: tx.wallet_account_id,
          label: `${tx.wallet_name} — paiement ${exp.expense_number}`,
          debit: 0, credit: Number(tx.amount),
        })),
      ];
      return this.insertEntry({
        workspaceId: exp.workspace_id,
        journal,
        date: exp.payment_date ? new Date(exp.payment_date) : new Date(),
        description: `Règlement dépense ${exp.expense_number} — ${exp.title}`,
        reference: exp.expense_number,
        lines,
        expenseId: exp.id,
      });
    }

    // 4. Calcul HT / TVA
    const totalTtc = Number(exp.amount);
    const tvaRate = Number(exp.tva_rate || 0);
    const hasTva = tvaRate > 0 && exp.tva_account_id;
    let ht = totalTtc;
    let tva = 0;
    if (hasTva) {
      ht = +(totalTtc / (1 + tvaRate / 100)).toFixed(2);
      tva = +(totalTtc - ht).toFixed(2);
    }

    // 5. Choix du journal — type de wallet dominant
    const totalsByType: Record<string, number> = {};
    for (const tx of txR.rows) {
      const t = tx.wallet_type || 'other';
      totalsByType[t] = (totalsByType[t] || 0) + Number(tx.amount);
    }
    const dominantType = Object.entries(totalsByType).sort((a, b) => b[1] - a[1])[0]?.[0];
    const journalCode = JOURNAL_CODE_BY_WALLET_TYPE[dominantType] || 'OD';

    const jR = await db.query<any>(
      `SELECT id, code FROM journals WHERE code = $1 AND workspace_id = $2 LIMIT 1`,
      [journalCode, exp.workspace_id]
    );
    if (jR.rows.length === 0) {
      throw new Error(`Journal '${journalCode}' introuvable pour ce workspace — exécuter la migration Phase C.`);
    }
    const journal = jR.rows[0];

    // 6. Numéro d'écriture séquentiel (journalCode-année-NNNN)
    const entryDate = exp.payment_date ? new Date(exp.payment_date) : new Date();
    const year = entryDate.getFullYear();
    const cntR = await db.query<any>(
      `SELECT COUNT(*)::int AS n FROM journal_entries
       WHERE journal_id = $1 AND fiscal_year = $2`,
      [journal.id, year]
    );
    const entryNumber = `${journal.code}-${year}-${String((cntR.rows[0]?.n || 0) + 1).padStart(4, '0')}`;
    const entrySlug = `JE-${uuidv4()}`; // UUID complet (slice = collisions)

    // 7. Construction des lignes (équilibrage par construction)
    type Line = { accountId: string; label: string; debit: number; credit: number };
    const lines: Line[] = [];

    lines.push({
      accountId: exp.charge_account_id,
      label: `${exp.type_label || exp.category_label || exp.category_code} — ${exp.title}`,
      debit: ht,
      credit: 0,
    });

    if (hasTva) {
      lines.push({
        accountId: exp.tva_account_id,
        label: `TVA déductible ${tvaRate}% — ${exp.expense_number}`,
        debit: tva,
        credit: 0,
      });
    }

    for (const tx of txR.rows) {
      lines.push({
        accountId: tx.wallet_account_id,
        label: `${tx.wallet_name} — paiement ${exp.expense_number}`,
        debit: 0,
        credit: Number(tx.amount),
      });
    }

    // Sanity check
    const sumDebit = lines.reduce((s, l) => s + l.debit, 0);
    const sumCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(sumDebit - sumCredit) > 0.02) {
      throw new Error(`Écriture déséquilibrée (débit ${sumDebit}, crédit ${sumCredit}) — bug interne du générateur.`);
    }

    // 8. Insertion en transaction SQL
    const entryUuid = await db.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO journal_entries (
           entry_id, entry_number, journal_id, entry_date, description, reference,
           status, posted_at, fiscal_year, fiscal_period, workspace_id, expense_id
         ) VALUES ($1, $2, $3, $4, $5, $6, 'posted', CURRENT_TIMESTAMP, $7, $8, $9, $10)
         RETURNING id`,
        [
          entrySlug,
          entryNumber,
          journal.id,
          entryDate.toISOString().slice(0, 10),
          `Paiement dépense ${exp.expense_number} — ${exp.title}`,
          exp.expense_number,
          year,
          entryDate.getMonth() + 1,
          exp.workspace_id,
          exp.id,
        ]
      );
      const entryUuid = ins.rows[0].id;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await client.query(
          `INSERT INTO journal_entry_lines (
             line_id, entry_id, line_number, account_id, label,
             debit_amount, credit_amount, reference
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [`JEL-${uuidv4()}`, entryUuid, i + 1, l.accountId, l.label, l.debit, l.credit, exp.expense_number]
        );
      }

      return entryUuid;
    });

    return entryUuid;
  }

  /**
   * OCTROI D'UNE AVANCE AU PERSONNEL (interne).
   *   Débit 425 Avances/acomptes au personnel / Crédit 5xx Trésorerie
   * Le solde 425 = la créance de l'entreprise sur le salarié (à récupérer
   * sur salaire). Réf AVA-<advance_number>, idempotent. La transaction de
   * trésorerie (débit caisse) est faite par l'appelant ; ici on ne fait
   * QUE l'écriture comptable. Compte caisse via le wallet, sinon 571.
   */
  async fromAdvanceGrant(advanceId: string): Promise<string> {
    const aR = await db.query<any>(
      `SELECT a.id, a.advance_number, a.amount, a.granted_at, a.workspace_id,
              e.full_name AS employee_name,
              w.type AS wallet_type, w.chart_account_id AS wallet_account_id
       FROM employee_advances_simple a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN wallets w ON w.id = a.wallet_id
       WHERE a.id::text = $1 LIMIT 1`,
      [advanceId]
    );
    if (aR.rows.length === 0) throw new Error('Avance introuvable pour écriture comptable');
    const a = aR.rows[0];
    const reference = `AVA-${a.advance_number}`;
    const existing = await db.query<any>(
      `SELECT id FROM journal_entries WHERE workspace_id = $1 AND reference = $2 LIMIT 1`,
      [a.workspace_id, reference]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    await this.ensureCoreAccounts(a.workspace_id);
    const advanceAcc = (await this.findAccount(a.workspace_id, '425'))
      ?? (await this.findAccount(a.workspace_id, '421'));
    if (!advanceAcc) throw new Error('Compte avances au personnel (425) introuvable au plan comptable');
    const cash = a.wallet_account_id ? { id: a.wallet_account_id }
      : await this.findAccount(a.workspace_id, '571');
    if (!cash) throw new Error('Compte de trésorerie introuvable au plan comptable');

    const code = a.wallet_type === 'bank' ? 'BAN' : a.wallet_type === 'mobile_money' ? 'MM' : 'CAI';
    const journal = await this.ensureJournal(
      a.workspace_id, code,
      code === 'CAI' ? 'Journal de caisse' : code === 'BAN' ? 'Journal de banque' : 'Journal mobile money',
      code === 'CAI' ? 'cash' : 'bank'
    );
    return this.insertEntry({
      workspaceId: a.workspace_id,
      journal,
      date: a.granted_at ? new Date(a.granted_at) : new Date(),
      description: `Avance au personnel ${a.advance_number} — ${a.employee_name}`,
      reference,
      lines: [
        { accountId: advanceAcc.id, label: `Avance ${a.employee_name}`, debit: Number(a.amount), credit: 0 },
        { accountId: cash.id, label: `Trésorerie — avance ${a.advance_number}`, debit: 0, credit: Number(a.amount) },
      ],
    });
  }

  /**
   * ENGAGEMENT D'UNE DÉPENSE / DETTE FOURNISSEUR (à l'approbation).
   *   Débit 6xx Charge (+ Débit 4456 TVA déductible) / Crédit 401 Fournisseurs
   * Le solde du compte 401 devient la VRAIE dette fournisseur (reçu mais pas
   * encore payé). Réf ENG-<expense_number>, SANS expense_id (pour ne pas
   * interférer avec l'idempotence de fromExpensePayment). Idempotent par réf.
   * Le paiement éteint ensuite la dette (D 401 / C 5xx, cf. fromExpensePayment).
   */
  async fromExpenseEngagement(expenseId: string): Promise<string> {
    const exR = await db.query<any>(
      `SELECT e.id, e.expense_number, e.title, e.amount, e.status, e.workspace_id, e.created_at,
              ec.code AS category_code, ec.label AS category_label, et.label AS type_label,
              COALESCE(et.charge_account_id, ec.charge_account_id) AS charge_account_id,
              COALESCE(et.tva_account_id,    ec.tva_account_id)    AS tva_account_id,
              COALESCE(et.tva_rate,          ec.tva_rate)          AS tva_rate
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       LEFT JOIN expense_types et      ON et.id = e.expense_type_id
       WHERE e.id::text = $1 OR e.expense_id = $1 LIMIT 1`,
      [expenseId]
    );
    if (exR.rows.length === 0) throw new Error('Dépense introuvable pour engagement comptable');
    const exp = exR.rows[0];
    if (!['approved', 'scheduled', 'paid'].includes(exp.status)) {
      throw new Error(`Engagement impossible : statut '${exp.status}'`);
    }

    const reference = `ENG-${exp.expense_number}`;
    const existing = await db.query<any>(
      `SELECT id FROM journal_entries WHERE workspace_id = $1 AND reference = $2 LIMIT 1`,
      [exp.workspace_id, reference]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    // GARDE ANTI-DOUBLE-CHARGE : si la dépense a déjà été payée par l'ancien
    // chemin (écriture de paiement D 6xx / C 5xx portant expense_id), la
    // charge est DÉJÀ au débit. Créer l'engagement la doublerait → on
    // renvoie l'écriture de paiement existante sans rien produire.
    const paidEntry = await db.query<any>(
      `SELECT id FROM journal_entries WHERE expense_id = $1 LIMIT 1`,
      [exp.id]
    );
    if (paidEntry.rows[0]) return paidEntry.rows[0].id;

    if (!exp.charge_account_id) {
      const target = exp.type_label ? `type '${exp.type_label}'` : `catégorie '${exp.category_code}'`;
      throw new Error(`${target} sans compte de charge — engagement impossible.`);
    }
    await this.ensureCoreAccounts(exp.workspace_id);
    const supplier = (await this.findAccount(exp.workspace_id, '401'))
      ?? (await this.findAccount(exp.workspace_id, '40'));
    if (!supplier) throw new Error('Compte fournisseurs (401) introuvable au plan comptable');

    const totalTtc = Number(exp.amount);
    const tvaRate = Number(exp.tva_rate || 0);
    const hasTva = tvaRate > 0 && exp.tva_account_id;
    const ht = hasTva ? +(totalTtc / (1 + tvaRate / 100)).toFixed(2) : totalTtc;
    const tva = hasTva ? +(totalTtc - ht).toFixed(2) : 0;

    const lines = [
      { accountId: exp.charge_account_id, label: `${exp.type_label || exp.category_label || exp.category_code} — ${exp.title}`, debit: ht, credit: 0 },
      ...(hasTva ? [{ accountId: exp.tva_account_id, label: `TVA déductible ${tvaRate}% — ${exp.expense_number}`, debit: tva, credit: 0 }] : []),
      { accountId: supplier.id, label: `Dette fournisseur — ${exp.expense_number}`, debit: 0, credit: totalTtc },
    ];

    const journal = await this.ensureJournal(exp.workspace_id, 'OD', 'Opérations diverses', 'general');
    return this.insertEntry({
      workspaceId: exp.workspace_id,
      journal,
      date: exp.created_at ? new Date(exp.created_at) : new Date(),
      description: `Engagement dépense ${exp.expense_number} — ${exp.title}`,
      reference,
      lines,
    });
  }

  // =========================================================================
  // VENTES — schéma OHADA classique :
  //   À la vente (journal VT)        : Débit 411 Clients  / Crédit 701 Ventes
  //   À l'encaissement (CAI/BAN/MM)  : Débit 5xx Trésorerie / Crédit 411 Clients
  // Le compte 411 se solde de lui-même pour les ventes au comptant et porte
  // les créances clients pour les ventes à crédit.
  // =========================================================================

  /** Compte par numéro exact, sinon par préfixe (ex. '411' → 411000). */
  private async findAccount(workspaceId: string, number: string): Promise<{ id: string; account_number: string } | null> {
    const exact = await db.query<any>(
      `SELECT id, account_number FROM chart_accounts
       WHERE workspace_id::text = $1 AND account_number = $2 LIMIT 1`,
      [workspaceId, number]
    );
    if (exact.rows[0]) return exact.rows[0];
    const pref = await db.query<any>(
      `SELECT id, account_number FROM chart_accounts
       WHERE workspace_id::text = $1 AND account_number LIKE $2 || '%'
       ORDER BY account_number ASC LIMIT 1`,
      [workspaceId, number]
    );
    return pref.rows[0] ?? null;
  }

  /**
   * GARANTIE : les comptes de tiers / charges / trésorerie SYSCOHADA dont
   * dépendent les générateurs (dettes incluses) existent. Idempotent
   * (ON CONFLICT), mémoïsé une fois par workspace et par process. Sans
   * cela, un workspace dont le plan n'a pas reçu la migration OHADA voit
   * ses écritures de dette rester 'pending' faute de compte 401/425…
   */
  private async ensureCoreAccounts(workspaceId: string): Promise<void> {
    if (JournalGenerationService.coreEnsured.has(workspaceId)) return;
    const CORE: Array<[string, string, string, string]> = [
      // numéro, libellé, account_type, account_class
      ['401', "Fournisseurs d'exploitation", 'liability', 'class_4'],
      ['411', 'Clients', 'asset', 'class_4'],
      ['421', 'Personnel — rémunérations dues', 'liability', 'class_4'],
      ['425', 'Personnel — avances et acomptes', 'asset', 'class_4'],
      ['431', 'Sécurité sociale (CNPS)', 'liability', 'class_4'],
      ['442', 'État — impôts (ITS)', 'liability', 'class_4'],
      ['447', 'État — autres impôts (FDFP)', 'liability', 'class_4'],
      ['445', 'État — TVA déductible', 'asset', 'class_4'],
      ['521', 'Banques', 'asset', 'class_5'],
      ['571', 'Caisse', 'asset', 'class_5'],
      ['601', 'Achats de marchandises', 'expense', 'class_6'],
      ['602', 'Achats de matières premières', 'expense', 'class_6'],
      ['661', 'Rémunérations du personnel', 'expense', 'class_6'],
      ['664', 'Charges sociales', 'expense', 'class_6'],
      ['701', 'Ventes de marchandises', 'revenue', 'class_7'],
    ];
    try {
      for (const [number, label, type, klass] of CORE) {
        await db.query(
          `INSERT INTO chart_accounts
             (account_id, account_number, label, account_type, account_class, is_active, allow_direct_posting, workspace_id)
           VALUES ($1, $2, $3, $4::account_type, $5::account_class, true, true, $6)
           ON CONFLICT (account_number, workspace_id) DO NOTHING`,
          [`ACC-${number}-${String(workspaceId).slice(0, 8)}`, number, label, type, klass, workspaceId]
        );
      }
      JournalGenerationService.coreEnsured.add(workspaceId);
    } catch (e: any) {
      // Plan comptable absent/colonnes différentes : on n'empêche rien,
      // le générateur appelant gérera l'absence de compte (reste pending).
      console.warn('[compta] ensureCoreAccounts:', e?.message ?? e);
    }
  }
  private static coreEnsured = new Set<string>();

  /** Journal par code — créé s'il n'existe pas (idempotent). */
  private async ensureJournal(workspaceId: string, code: string, label: string, type: string): Promise<{ id: string; code: string }> {
    const found = await db.query<any>(
      `SELECT id, code FROM journals WHERE code = $1 AND workspace_id::text = $2 LIMIT 1`,
      [code, workspaceId]
    );
    if (found.rows[0]) return found.rows[0];
    const ins = await db.query<any>(
      `INSERT INTO journals (journal_id, code, label, journal_type, is_active, workspace_id)
       VALUES ($1, $2, $3, $4, true, $5)
       RETURNING id, code`,
      [uuidv4(), code, label, type, workspaceId]
    );
    return ins.rows[0];
  }

  /** Numéro séquentiel JOURNAL-ANNÉE-NNNN (même convention que les dépenses). */
  private async nextEntryNumber(journalId: string, journalCode: string, year: number): Promise<string> {
    const cntR = await db.query<any>(
      `SELECT COUNT(*)::int AS n FROM journal_entries
       WHERE journal_id = $1 AND fiscal_year = $2`,
      [journalId, year]
    );
    return `${journalCode}-${year}-${String((cntR.rows[0]?.n || 0) + 1).padStart(4, '0')}`;
  }

  private async insertEntry(opts: {
    workspaceId: string;
    journal: { id: string; code: string };
    date: Date;
    description: string;
    reference: string;
    lines: Array<{ accountId: string; label: string; debit: number; credit: number }>;
    expenseId?: string | null;
  }): Promise<string> {
    const year = opts.date.getFullYear();
    const entryNumber = await this.nextEntryNumber(opts.journal.id, opts.journal.code, year);

    const sumDebit = opts.lines.reduce((s, l) => s + l.debit, 0);
    const sumCredit = opts.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(sumDebit - sumCredit) > 0.02) {
      throw new Error(`Écriture déséquilibrée (débit ${sumDebit}, crédit ${sumCredit}) — bug interne du générateur.`);
    }

    return await db.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO journal_entries (
           entry_id, entry_number, journal_id, entry_date, description, reference,
           status, posted_at, fiscal_year, fiscal_period, workspace_id, expense_id
         ) VALUES ($1, $2, $3, $4, $5, $6, 'posted', CURRENT_TIMESTAMP, $7, $8, $9, $10)
         RETURNING id`,
        [
          `JE-${uuidv4()}`,
          entryNumber,
          opts.journal.id,
          opts.date.toISOString().slice(0, 10),
          opts.description,
          opts.reference,
          year,
          opts.date.getMonth() + 1,
          opts.workspaceId,
          opts.expenseId ?? null,
        ]
      );
      const entryUuid = ins.rows[0].id;
      for (let i = 0; i < opts.lines.length; i++) {
        const l = opts.lines[i];
        await client.query(
          `INSERT INTO journal_entry_lines (
             line_id, entry_id, line_number, account_id, label,
             debit_amount, credit_amount, reference
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [`JEL-${uuidv4()}`, entryUuid, i + 1, l.accountId, l.label, l.debit, l.credit, opts.reference]
        );
      }
      return entryUuid;
    });
  }

  /**
   * Écriture de VENTE (journal VT) : Débit 411 Clients / Crédit 701 Ventes,
   * pour le montant TOTAL de la vente. Idempotent par sale_number.
   * Throw si les comptes 411/701 ne sont pas au plan comptable — l'appelant
   * décide (les hooks POS appellent en best-effort et loggent).
   */
  async fromSale(saleUuid: string): Promise<string> {
    const sR = await db.query<any>(
      `SELECT s.id, s.sale_number, s.total_amount, s.created_at, s.workspace_id,
              s.status, COALESCE(c.name, s.client_name) AS client_name
       FROM sales s
       LEFT JOIN clients c ON c.id = s.client_id
       WHERE s.id::text = $1 OR s.sale_id = $1
       LIMIT 1`,
      [saleUuid]
    );
    if (sR.rows.length === 0) throw new Error('Vente introuvable pour génération comptable');
    const sale = sR.rows[0];
    if (sale.status === 'cancelled') throw new Error('Vente annulée — pas d\'écriture.');

    // Idempotence par référence
    const existing = await db.query<any>(
      `SELECT id FROM journal_entries WHERE reference = $1 AND workspace_id::text = $2 AND description LIKE 'Vente %' LIMIT 1`,
      [sale.sale_number, sale.workspace_id]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    await this.ensureCoreAccounts(sale.workspace_id);
    const clients = await this.findAccount(sale.workspace_id, '411');
    const ventes = await this.findAccount(sale.workspace_id, '701');
    if (!clients || !ventes) {
      throw new Error('Comptes 411 (Clients) ou 701 (Ventes) absents du plan comptable — initialiser le plan.');
    }

    const journal = await this.ensureJournal(sale.workspace_id, 'VT', 'Journal des ventes', 'sales');
    const total = Number(sale.total_amount);
    const who = sale.client_name || 'client comptant';

    return await this.insertEntry({
      workspaceId: sale.workspace_id,
      journal,
      date: new Date(sale.created_at),
      description: `Vente ${sale.sale_number} — ${who}`,
      reference: sale.sale_number,
      lines: [
        { accountId: clients.id, label: `Client ${who} — vente ${sale.sale_number}`, debit: total, credit: 0 },
        { accountId: ventes.id, label: `Ventes de marchandises — ${sale.sale_number}`, debit: 0, credit: total },
      ],
    });
  }

  /**
   * Écriture d'ENCAISSEMENT (journal CAI/BAN/MM selon le wallet) :
   * Débit 5xx Trésorerie / Crédit 411 Clients, pour le montant payé.
   * Idempotent par payment_number. Le compte de trésorerie vient du
   * mapping du wallet (chart_account_id) avec repli par type de wallet
   * (cash → 571, sinon 521).
   */
  async fromSalePayment(paymentUuid: string): Promise<string> {
    const pR = await db.query<any>(
      `SELECT p.id, p.payment_number, p.amount, p.payment_date, p.workspace_id,
              s.sale_number, COALESCE(c.name, s.client_name) AS client_name,
              w.type AS wallet_type, w.name AS wallet_name, w.chart_account_id AS wallet_account_id
       FROM sale_payments p
       JOIN sales s ON s.id = p.sale_id
       LEFT JOIN clients c ON c.id = s.client_id
       LEFT JOIN wallets w ON w.id = p.wallet_id
       WHERE p.id::text = $1 OR p.payment_id = $1
       LIMIT 1`,
      [paymentUuid]
    );
    if (pR.rows.length === 0) throw new Error('Paiement introuvable pour génération comptable');
    const pay = pR.rows[0];

    const existing = await db.query<any>(
      `SELECT id FROM journal_entries WHERE reference = $1 AND workspace_id::text = $2 LIMIT 1`,
      [pay.payment_number, pay.workspace_id]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    await this.ensureCoreAccounts(pay.workspace_id);
    const clients = await this.findAccount(pay.workspace_id, '411');
    if (!clients) throw new Error('Compte 411 (Clients) absent du plan comptable — initialiser le plan.');

    // Compte de trésorerie : mapping wallet > repli par type de wallet
    let treasuryAccountId: string | null = pay.wallet_account_id;
    if (!treasuryAccountId) {
      const fallbackNumber = pay.wallet_type === 'cash' || !pay.wallet_type ? '571' : '521';
      const acc = await this.findAccount(pay.workspace_id, fallbackNumber);
      treasuryAccountId = acc?.id ?? null;
    }
    if (!treasuryAccountId) {
      throw new Error(`Wallet "${pay.wallet_name || '—'}" sans compte de trésorerie (mapping wallet ou comptes 571/521 manquants).`);
    }

    const journalCode = JOURNAL_CODE_BY_WALLET_TYPE[pay.wallet_type] || 'CAI';
    const journalLabels: Record<string, string> = { CAI: 'Journal de caisse', BAN: 'Journal de banque', MM: 'Journal mobile money' };
    const journal = await this.ensureJournal(
      pay.workspace_id, journalCode, journalLabels[journalCode] || 'Journal de caisse',
      journalCode === 'CAI' ? 'cash' : 'bank'
    );

    const amount = Number(pay.amount);
    const who = pay.client_name || 'client comptant';
    const date = pay.payment_date ? new Date(pay.payment_date) : new Date();

    return await this.insertEntry({
      workspaceId: pay.workspace_id,
      journal,
      date,
      description: `Encaissement vente ${pay.sale_number} — ${pay.payment_number}`,
      reference: pay.payment_number,
      lines: [
        { accountId: treasuryAccountId, label: `${pay.wallet_name || 'Caisse'} — encaissement ${pay.sale_number}`, debit: amount, credit: 0 },
        { accountId: clients.id, label: `Client ${who} — règlement ${pay.sale_number}`, debit: 0, credit: amount },
      ],
    });
  }

  /**
   * Écriture de SORTIE DE CAISSE (journal CAI) pour une charge payée en
   * espèces par un stand : Débit compte de charge / Crédit caisse.
   * Utilisé pour les primes commerciaux versées à la clôture de caisse.
   * Throw si aucun compte de charge ne matche — l'appelant gère (best-effort).
   */
  async fromCashPayout(opts: {
    workspaceId: string;
    date: Date;
    reference: string;
    description: string;
    amount: number;
    /** Compte caisse du wallet du stand (chart_account_id) ; repli 571 */
    cashAccountId?: string | null;
    /** Préfixes de compte de charge à essayer dans l'ordre (ex. ['6614','661','66']) */
    chargeAccountPrefixes: string[];
  }): Promise<string> {
    await this.ensureCoreAccounts(opts.workspaceId);
    let charge: { id: string } | null = null;
    for (const prefix of opts.chargeAccountPrefixes) {
      charge = await this.findAccount(opts.workspaceId, prefix);
      if (charge) break;
    }
    if (!charge) throw new Error(`Aucun compte de charge (${opts.chargeAccountPrefixes.join('/')}) au plan comptable`);
    const cash = opts.cashAccountId
      ? { id: opts.cashAccountId }
      : await this.findAccount(opts.workspaceId, '571');
    if (!cash) throw new Error('Compte caisse (571) introuvable au plan comptable');

    const journal = await this.ensureJournal(opts.workspaceId, 'CAI', 'Journal de caisse', 'cash');
    return this.insertEntry({
      workspaceId: opts.workspaceId,
      journal,
      date: opts.date,
      description: opts.description,
      reference: opts.reference,
      lines: [
        { accountId: charge.id, label: opts.description, debit: opts.amount, credit: 0 },
        { accountId: cash.id, label: `Caisse — ${opts.reference}`, debit: 0, credit: opts.amount },
      ],
    });
  }

  /**
   * Écriture de PAIE (au paiement d'un bulletin) — OHADA :
   *   D 661  Rémunérations (brut − acomptes espèces déjà passés en 661
   *          aux clôtures de caisse — pas de double charge)
   *   D 664  Charges sociales patronales (CNPS pat. + CMU + FDFP)
   *   C 421  Personnel — net dû (éteint ensuite par chaque versement)
   *   C 431  CNPS & organismes sociaux (part salariale + patronale + CMU)
   *   C 442x ITS retenu à la source (dette envers la DGI)
   *   C 447x FDFP (TAP + TFPC)
   * Les comptes 421/43x/44x matérialisent les DETTES (salaires à verser,
   * organismes à régler le 15) — les paiements FRACTIONNÉS les éteignent
   * au fur et à mesure via fromSalaryDisbursement / fromLiabilitySettlement.
   * Idempotent par numéro de bulletin.
   */
  async fromPayrollPayment(payrollUuid: string, _opts?: { treasuryAccountId?: string | null; journalCode?: 'BAN' | 'CAI' }): Promise<string> {
    const pR = await db.query<any>(
      `SELECT p.*, e.full_name
       FROM payrolls p LEFT JOIN employees e ON e.id = p.employee_id
       WHERE p.id::text = $1 OR p.payroll_id = $1 LIMIT 1`,
      [payrollUuid]
    );
    if (!pR.rows[0]) throw new Error('Paie introuvable');
    const p = pR.rows[0];

    const existing = await db.query<any>(
      `SELECT je.id FROM journal_entries je
       WHERE je.workspace_id = $1 AND je.reference = $2 LIMIT 1`,
      [p.workspace_id, p.payroll_number]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const ec = typeof p.employer_charges === 'string' ? JSON.parse(p.employer_charges) : (p.employer_charges || {});
    const grossTotal = Number(p.gross_total ?? p.base_salary) || 0;
    const advances = Number(p.advance_deduction) || 0;
    const otherDeductions = Number(p.deductions) || 0;
    const net = Number(p.net_salary) || 0;
    const cnpsEmployee = Number(p.cnps_employee) || 0;
    const its = Number(p.its_amount) || 0;
    const employerTotal = Number(p.employer_total) || 0;
    const fdfp = (Number(ec.fdfpApprenticeship) || 0) + (Number(ec.fdfpContinuingTraining) || 0);
    const social = cnpsEmployee + (employerTotal - fdfp); // CNPS sal. + pat. + CMU

    const need = async (prefixes: string[], what: string) => {
      for (const pr of prefixes) {
        const acc = await this.findAccount(p.workspace_id, pr);
        if (acc) return acc;
      }
      throw new Error(`Compte ${what} (${prefixes.join('/')}) introuvable au plan comptable`);
    };
    await this.ensureCoreAccounts(p.workspace_id);
    const remun = await need(['661', '66'], 'rémunérations');
    const staff = await need(['421', '42'], 'personnel — net dû');

    const who = p.full_name || p.payroll_number;
    const lines: Array<{ accountId: string; label: string; debit: number; credit: number }> = [
      { accountId: remun.id, label: `Salaire ${who} — ${p.period}`, debit: grossTotal - advances, credit: 0 },
    ];
    if (employerTotal > 0) {
      const chargeAcc = await need(['664', '66'], 'charges sociales patronales');
      lines.push({ accountId: chargeAcc.id, label: `Charges patronales ${who} — ${p.period}`, debit: employerTotal, credit: 0 });
    }
    lines.push({ accountId: staff.id, label: `Net dû ${who} — ${p.period}`, debit: 0, credit: net });
    if (social > 0) {
      const acc = await need(['431', '43'], 'organismes sociaux');
      lines.push({ accountId: acc.id, label: `CNPS + CMU dues — ${p.period}`, debit: 0, credit: social });
    }
    if (its > 0) {
      const acc = await need(['442', '44'], 'État — ITS');
      lines.push({ accountId: acc.id, label: `ITS retenu à la source — ${p.period}`, debit: 0, credit: its });
    }
    if (fdfp > 0) {
      const acc = await need(['447', '44'], 'État — FDFP');
      lines.push({ accountId: acc.id, label: `FDFP (TAP + TFPC) — ${p.period}`, debit: 0, credit: fdfp });
    }
    if (otherDeductions > 0) {
      const acc = await need(['421', '42'], 'personnel');
      lines.push({ accountId: acc.id, label: `Retenues diverses ${who} — ${p.period}`, debit: 0, credit: otherDeductions });
    }
    // Récupération d'avance au personnel : le net dû (421) est déjà
    // réduit du montant récupéré → on crédite 425 pour éteindre la
    // créance (D 425 à l'octroi). L'entrée reste équilibrée.
    const advanceRecovery = Number(p.advance_recovery) || 0;
    if (advanceRecovery > 0) {
      const acc = await this.findAccount(p.workspace_id, '425') ?? await this.findAccount(p.workspace_id, '42');
      if (acc) lines.push({ accountId: acc.id, label: `Récupération avance ${who} — ${p.period}`, debit: 0, credit: advanceRecovery });
    }

    const journal = await this.ensureJournal(p.workspace_id, 'OD', 'Opérations diverses', 'general');
    return this.insertEntry({
      workspaceId: p.workspace_id,
      journal,
      date: p.payment_date ? new Date(p.payment_date) : new Date(),
      description: `Paie ${p.period} — ${who} (${p.payroll_number})`,
      reference: p.payroll_number,
      lines,
    });
  }

  /**
   * VERSEMENT de salaire (total ou partiel) : D 421 Personnel ÷ C 5xx.
   * Une écriture par versement — référence ${'$'}{payrollNumber}-V${'$'}{seq}.
   */
  async fromSalaryDisbursement(opts: {
    workspaceId: string;
    payrollNumber: string;
    employeeName: string;
    period: string;
    seq: number;
    date: Date;
    amount: number;
    treasuryAccountId?: string | null;
    journalCode?: 'BAN' | 'CAI';
  }): Promise<string> {
    const reference = `${opts.payrollNumber}-V${opts.seq}`;
    const existing = await db.query<any>(
      `SELECT id FROM journal_entries WHERE workspace_id = $1 AND reference = $2 LIMIT 1`,
      [opts.workspaceId, reference]
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const staff = await this.findAccount(opts.workspaceId, '421')
      ?? await this.findAccount(opts.workspaceId, '42');
    if (!staff) throw new Error('Compte personnel (421) introuvable au plan comptable');
    const treasury = opts.treasuryAccountId
      ? { id: opts.treasuryAccountId }
      : await this.findAccount(opts.workspaceId, opts.journalCode === 'CAI' ? '571' : '521');
    if (!treasury) throw new Error('Compte de trésorerie introuvable au plan comptable');

    const code = opts.journalCode ?? 'BAN';
    const journal = await this.ensureJournal(
      opts.workspaceId, code,
      code === 'CAI' ? 'Journal de caisse' : 'Journal de banque',
      code === 'CAI' ? 'cash' : 'bank'
    );
    return this.insertEntry({
      workspaceId: opts.workspaceId,
      journal,
      date: opts.date,
      description: `Versement salaire ${opts.period} — ${opts.employeeName} (n°${opts.seq})`,
      reference,
      lines: [
        { accountId: staff.id, label: `Personnel — versement ${reference}`, debit: opts.amount, credit: 0 },
        { accountId: treasury.id, label: `Trésorerie — ${reference}`, debit: 0, credit: opts.amount },
      ],
    });
  }

  /**
   * Écriture de RÈGLEMENT D'UNE DETTE (sociale ou fiscale) par la banque :
   * Débit 43x/44x (extinction de la dette) / Crédit 521.
   */
  async fromLiabilitySettlement(opts: {
    workspaceId: string;
    date: Date;
    reference: string;
    description: string;
    amount: number;
    debitAccountPrefixes: string[];
    treasuryAccountId?: string | null;
  }): Promise<string> {
    await this.ensureCoreAccounts(opts.workspaceId);
    let debit: { id: string } | null = null;
    for (const prefix of opts.debitAccountPrefixes) {
      debit = await this.findAccount(opts.workspaceId, prefix);
      if (debit) break;
    }
    if (!debit) throw new Error(`Compte de dette (${opts.debitAccountPrefixes.join('/')}) introuvable`);
    const treasury = opts.treasuryAccountId
      ? { id: opts.treasuryAccountId }
      : await this.findAccount(opts.workspaceId, '521');
    if (!treasury) throw new Error('Compte banque (521) introuvable au plan comptable');

    const journal = await this.ensureJournal(opts.workspaceId, 'BAN', 'Journal de banque', 'bank');
    return this.insertEntry({
      workspaceId: opts.workspaceId,
      journal,
      date: opts.date,
      description: opts.description,
      reference: opts.reference,
      lines: [
        { accountId: debit.id, label: opts.description, debit: opts.amount, credit: 0 },
        { accountId: treasury.id, label: `Banque — ${opts.reference}`, debit: 0, credit: opts.amount },
      ],
    });
  }

  /**
   * Récupère l'écriture comptable liée à une dépense (entête + lignes
   * détaillées avec libellé des comptes) pour affichage UI.
   * Retourne null s'il n'y en a pas.
   */
  async getByExpenseId(expenseId: string): Promise<any | null> {
    const eR = await db.query<any>(
      `SELECT je.id, je.entry_number, je.entry_date, je.description,
              je.status, je.fiscal_year, je.fiscal_period,
              j.code AS journal_code, j.label AS journal_label
       FROM journal_entries je
       JOIN journals j ON j.id = je.journal_id
       WHERE je.expense_id::text = $1 OR EXISTS (
         SELECT 1 FROM expenses e WHERE e.id = je.expense_id AND e.expense_id = $1
       )
       LIMIT 1`,
      [expenseId]
    );
    if (eR.rows.length === 0) return null;
    const entry = eR.rows[0];

    const lR = await db.query<any>(
      `SELECT jel.id, jel.line_number, jel.label,
              jel.debit_amount, jel.credit_amount,
              ca.account_number, ca.label AS account_label
       FROM journal_entry_lines jel
       JOIN chart_accounts ca ON ca.id = jel.account_id
       WHERE jel.entry_id = $1
       ORDER BY jel.line_number ASC`,
      [entry.id]
    );

    return { ...entry, lines: lR.rows };
  }
}
