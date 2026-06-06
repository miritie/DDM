/**
 * Service — États financiers annuels (SYSCOHADA révisé, Système Normal)
 *
 * Construit, pour un exercice donné, l'ensemble du dossier réglementaire :
 *   - Balance générale (agrégat débit/crédit par compte)
 *   - Bilan (Actif / Passif, résultat de l'exercice intégré au passif)
 *   - Compte de résultat (charges classe 6 / produits classe 7)
 *   - Tableau des flux de trésorerie simplifié (méthode directe, depuis
 *     les transactions de trésorerie) + soldes des caisses
 *   - Livre-journal (chronologique, totaux par écriture)
 *   - Grand livre synthétique (mouvements par compte)
 *   - Identité de l'entreprise (branding workspace) pour la page de garde
 *
 * Sert l'API /api/accounting/reports/financial-statements, consommée par
 * la page de préparation ET le générateur PDF (dossier à faire viser par
 * l'expert-comptable / CGA avant dépôt de la DSF à la DGI).
 */

import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export interface StatementLine { number: string; label: string; amount: number }

export interface FinancialStatements {
  company: {
    name: string; slogan: string | null; address: string | null;
    phone: string | null; email: string | null; logoUrl: string | null;
    currency: string;
  };
  fiscalYear: number;
  trialBalance: Array<{ number: string; label: string; debit: number; credit: number }>;
  bilan: {
    actif: StatementLine[];
    passif: StatementLine[];
    resultat: number;
    totalActif: number;
    totalPassif: number;
  };
  resultat: {
    charges: StatementLine[];
    produits: StatementLine[];
    totalCharges: number;
    totalProduits: number;
    resultat: number;
  };
  tft: {
    inflows: Array<{ category: string; amount: number }>;
    outflows: Array<{ category: string; amount: number }>;
    totalIn: number;
    totalOut: number;
    net: number;
    wallets: Array<{ name: string; type: string; balance: number }>;
  };
  journal: Array<{
    entryNumber: string; date: string; journalCode: string;
    description: string; reference: string | null; amount: number; status: string;
  }>;
  ledger: Array<{
    number: string; label: string; debit: number; credit: number;
    solde: number; linesCount: number;
  }>;
}

export class FinancialStatementsService {
  async build(workspaceId: string, fiscalYear: number): Promise<FinancialStatements> {
    const [company, balanceRows, tftRows, walletRows, journalRows] = await Promise.all([
      this.loadCompany(workspaceId),
      this.loadBalance(workspaceId, fiscalYear),
      this.loadTreasuryFlows(workspaceId, fiscalYear),
      this.loadWallets(workspaceId),
      this.loadJournal(workspaceId, fiscalYear),
    ]);

    // ---- Bilan + Compte de résultat depuis la balance (classes OHADA) ----
    const actif: StatementLine[] = [];
    const passif: StatementLine[] = [];
    const charges: StatementLine[] = [];
    const produits: StatementLine[] = [];

    for (const r of balanceRows) {
      const solde = r.debit - r.credit;
      if (Math.abs(solde) < 0.005) continue;
      const cls = (r.number || '?').charAt(0);
      const line = { number: r.number, label: r.label, amount: Math.abs(solde) };

      if (cls === '6') { charges.push({ ...line, amount: solde }); continue; }
      if (cls === '7') { produits.push({ ...line, amount: -solde }); continue; }

      if (cls === '2' || cls === '3' || cls === '5') {
        (solde >= 0 ? actif : passif).push(line);   // classe 5 créditrice = découvert → passif
      } else if (cls === '4') {
        (solde >= 0 ? actif : passif).push(line);   // tiers débiteurs/créditeurs
      } else {
        (solde < 0 ? passif : actif).push(line);    // classe 1 capitaux et autres
      }
    }

    const totalCharges = charges.reduce((s, l) => s + l.amount, 0);
    const totalProduits = produits.reduce((s, l) => s + l.amount, 0);
    const resultat = totalProduits - totalCharges;
    const totalActif = actif.reduce((s, l) => s + l.amount, 0);
    const totalPassifHorsResultat = passif.reduce((s, l) => s + l.amount, 0);

    // ---- TFT (méthode directe) ----
    const inflows = new Map<string, number>();
    const outflows = new Map<string, number>();
    for (const t of tftRows) {
      if (t.type === 'transfer') continue;
      const m = t.type === 'income' ? inflows : outflows;
      m.set(t.category, (m.get(t.category) || 0) + t.amount);
    }
    const totalIn = [...inflows.values()].reduce((s, v) => s + v, 0);
    const totalOut = [...outflows.values()].reduce((s, v) => s + v, 0);

    // ---- Grand livre synthétique ----
    const ledger = balanceRows.map(r => ({
      number: r.number,
      label: r.label,
      debit: r.debit,
      credit: r.credit,
      solde: r.debit - r.credit,
      linesCount: r.lines_count,
    }));

    return {
      company,
      fiscalYear,
      trialBalance: balanceRows.map(({ number, label, debit, credit }) => ({ number, label, debit, credit })),
      bilan: {
        actif: actif.sort((a, b) => a.number.localeCompare(b.number)),
        passif: passif.sort((a, b) => a.number.localeCompare(b.number)),
        resultat,
        totalActif,
        totalPassif: totalPassifHorsResultat + resultat,
      },
      resultat: {
        charges: charges.sort((a, b) => a.number.localeCompare(b.number)),
        produits: produits.sort((a, b) => a.number.localeCompare(b.number)),
        totalCharges,
        totalProduits,
        resultat,
      },
      tft: {
        inflows: [...inflows.entries()].map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
        outflows: [...outflows.entries()].map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
        totalIn,
        totalOut,
        net: totalIn - totalOut,
        wallets: walletRows,
      },
      journal: journalRows,
      ledger,
    };
  }

  /** Mouvements détaillés d'un compte (grand livre, drill-down). */
  async accountLedger(workspaceId: string, fiscalYear: number, accountNumber: string) {
    const r = await db.query<any>(
      `SELECT e.entry_number  AS "entryNumber",
              e.entry_date::date::text AS "date",
              j.code          AS "journalCode",
              l.label         AS "label",
              e.reference     AS "reference",
              l.debit_amount::float  AS "debit",
              l.credit_amount::float AS "credit"
       FROM journal_entry_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       LEFT JOIN journals j ON j.id = e.journal_id
       JOIN chart_accounts ca ON ca.id = l.account_id
       WHERE e.workspace_id::text = $1
         AND e.status IN ('posted', 'validated')
         AND e.fiscal_year = $2
         AND ca.account_number = $3
       ORDER BY e.entry_date ASC, e.entry_number ASC, l.line_number ASC`,
      [workspaceId, fiscalYear, accountNumber]
    );
    return r.rows;
  }

  // -------------------------------------------------------------------------

  private async loadCompany(workspaceId: string) {
    const r = await db.query<any>(
      `SELECT name, slogan, address, phone, email, logo_url, currency
       FROM workspaces WHERE id::text = $1 OR workspace_id = $1 OR slug = $1 LIMIT 1`,
      [workspaceId]
    );
    const w = r.rows[0] || {};
    return {
      name: w.name || 'Entreprise',
      slogan: w.slogan ?? null,
      address: w.address ?? null,
      phone: w.phone ?? null,
      email: w.email ?? null,
      logoUrl: w.logo_url ?? null,
      currency: w.currency || 'XOF',
    };
  }

  private async loadBalance(workspaceId: string, fiscalYear: number) {
    const r = await db.query<any>(
      `SELECT COALESCE(ca.account_number, '?') AS number,
              COALESCE(ca.label, 'Compte inconnu') AS label,
              SUM(l.debit_amount)::float  AS debit,
              SUM(l.credit_amount)::float AS credit,
              COUNT(*)::int AS lines_count
       FROM journal_entry_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       LEFT JOIN chart_accounts ca ON ca.id = l.account_id
       WHERE e.workspace_id::text = $1
         AND e.status IN ('posted', 'validated')
         AND e.fiscal_year = $2
       GROUP BY 1, 2
       ORDER BY 1 ASC`,
      [workspaceId, fiscalYear]
    );
    return r.rows as Array<{ number: string; label: string; debit: number; credit: number; lines_count: number }>;
  }

  private async loadTreasuryFlows(workspaceId: string, fiscalYear: number) {
    const r = await db.query<any>(
      `SELECT type, COALESCE(category::text, 'other') AS category, SUM(amount)::float AS amount
       FROM transactions
       WHERE workspace_id::text = $1
         AND status = 'completed'
         AND EXTRACT(YEAR FROM processed_at) = $2
       GROUP BY 1, 2`,
      [workspaceId, fiscalYear]
    );
    return r.rows as Array<{ type: string; category: string; amount: number }>;
  }

  private async loadWallets(workspaceId: string) {
    const r = await db.query<any>(
      `SELECT name, type, balance::float AS balance
       FROM wallets
       WHERE workspace_id::text = $1 AND is_active = true
       ORDER BY name ASC`,
      [workspaceId]
    );
    return r.rows as Array<{ name: string; type: string; balance: number }>;
  }

  private async loadJournal(workspaceId: string, fiscalYear: number) {
    const r = await db.query<any>(
      `SELECT e.entry_number AS "entryNumber",
              e.entry_date::date::text AS "date",
              COALESCE(j.code, '—') AS "journalCode",
              e.description  AS "description",
              e.reference    AS "reference",
              e.status       AS "status",
              (SELECT COALESCE(SUM(l.debit_amount), 0)::float
               FROM journal_entry_lines l WHERE l.entry_id = e.id) AS "amount"
       FROM journal_entries e
       LEFT JOIN journals j ON j.id = e.journal_id
       WHERE e.workspace_id::text = $1
         AND e.status IN ('posted', 'validated')
         AND e.fiscal_year = $2
       ORDER BY e.entry_date ASC, e.entry_number ASC`,
      [workspaceId, fiscalYear]
    );
    return r.rows;
  }
}
