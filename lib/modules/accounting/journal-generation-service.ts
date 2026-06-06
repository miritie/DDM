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
    const entrySlug = `JE-${uuidv4().slice(0, 8)}`;

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
          [`JEL-${uuidv4().slice(0, 8)}`, entryUuid, i + 1, l.accountId, l.label, l.debit, l.credit, exp.expense_number]
        );
      }

      return entryUuid;
    });

    return entryUuid;
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
           status, posted_at, fiscal_year, fiscal_period, workspace_id
         ) VALUES ($1, $2, $3, $4, $5, $6, 'posted', CURRENT_TIMESTAMP, $7, $8, $9)
         RETURNING id`,
        [
          `JE-${uuidv4().slice(0, 8)}`,
          entryNumber,
          opts.journal.id,
          opts.date.toISOString().slice(0, 10),
          opts.description,
          opts.reference,
          year,
          opts.date.getMonth() + 1,
          opts.workspaceId,
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
          [`JEL-${uuidv4().slice(0, 8)}`, entryUuid, i + 1, l.accountId, l.label, l.debit, l.credit, opts.reference]
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
