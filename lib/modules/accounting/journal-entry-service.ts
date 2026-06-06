/**
 * Service - Gestion des Écritures Comptables
 * Module Comptabilité
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { JournalEntry, JournalEntryLine, AccountBalance, TrialBalance, Journal, ChartAccount } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateJournalEntryInput {
  journalId: string;
  entryDate: string;
  description: string;
  reference?: string;
  lines: Array<{
    accountId: string;
    label: string;
    debitAmount: number;
    creditAmount: number;
    analyticalCode?: string;
    costCenter?: string;
  }>;
  workspaceId: string;
}

export class JournalEntryService {
  async generateEntryNumber(journalCode: string, workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const entries = await postgresClient.list<JournalEntry>('journal_entries', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({EntryDate}) = ${year})`,
    });
    return `${journalCode}-${year}-${String(entries.length + 1).padStart(4, '0')}`;
  }

  validateEntry(lines: Array<{ debitAmount: number; creditAmount: number }>): void {
    const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`L'écriture n'est pas équilibrée: Débit = ${totalDebit}, Crédit = ${totalCredit}`);
    }

    if (lines.length < 2) {
      throw new Error('Une écriture comptable doit avoir au moins 2 lignes');
    }
  }

  async create(input: CreateJournalEntryInput): Promise<JournalEntry> {
    // Validation
    this.validateEntry(input.lines);

    const entryDate = new Date(input.entryDate);
    const fiscalYear = entryDate.getFullYear();
    const fiscalPeriod = entryDate.getMonth() + 1;

    // Get journal code for entry number
    const journal = await postgresClient.list<Journal>('journals', {
      filterByFormula: `{JournalId} = '${input.journalId}'`,
    });
    const journalCode = journal[0]?.Code || 'OD';

    const entryNumber = await this.generateEntryNumber(journalCode, input.workspaceId);

    const entry = {
      EntryId: uuidv4(),
      EntryNumber: entryNumber,
      JournalId: input.journalId,
      EntryDate: input.entryDate,
      Description: input.description,
      Reference: input.reference,
      Status: 'draft' as const,
      FiscalYear: fiscalYear,
      FiscalPeriod: fiscalPeriod,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdEntry = await postgresClient.create<JournalEntry>('journal_entries', entry);

    // Create lines
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      const entryLine = {
        LineId: uuidv4(),
        EntryId: createdEntry.EntryId,
        LineNumber: i + 1,
        AccountId: line.accountId,
        Label: line.label,
        DebitAmount: line.debitAmount,
        CreditAmount: line.creditAmount,
        AnalyticalCode: line.analyticalCode,
        CostCenter: line.costCenter,
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      };

      await postgresClient.create<JournalEntryLine>('journal_entry_lines', entryLine);
    }

    return createdEntry;
  }

  async getById(entryId: string): Promise<JournalEntry | null> {
    const entries = await postgresClient.list<JournalEntry>('journal_entries', {
      filterByFormula: `{EntryId} = '${entryId}'`,
    });
    return entries.length > 0 ? entries[0] : null;
  }

  /**
   * Lignes d'une écriture. Accepte l'ID métier (JE-…) ou l'UUID PK :
   * `journal_entry_lines.entry_id` est un UUID FK — l'ancien filtre
   * `entry_id = 'JE-…'` levait « invalid input syntax for type uuid »
   * (balance/bilan/compte de résultat en erreur). Le compte est joint
   * pour exposer son numéro et son libellé.
   */
  async getLines(entryId: string): Promise<(JournalEntryLine & { AccountNumber?: string; AccountLabel?: string })[]> {
    const r = await postgresClient.query<any>(
      `SELECT
         l.line_id        AS "LineId",
         l.entry_id       AS "EntryId",
         l.line_number    AS "LineNumber",
         l.account_id     AS "AccountId",
         l.label          AS "Label",
         l.debit_amount::float  AS "DebitAmount",
         l.credit_amount::float AS "CreditAmount",
         l.analytical_code AS "AnalyticalCode",
         l.cost_center    AS "CostCenter",
         l.reference      AS "Reference",
         l.created_at     AS "CreatedAt",
         ca.account_number AS "AccountNumber",
         ca.label          AS "AccountLabel"
       FROM journal_entry_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       LEFT JOIN chart_accounts ca ON ca.id = l.account_id
       WHERE e.entry_id = $1 OR e.id::text = $1
       ORDER BY l.line_number ASC`,
      [entryId]
    );
    return r.rows;
  }

  /**
   * Liste des écritures. `journalId` accepte l'UUID PK (journals.id) OU le
   * code métier (journals.journal_id) : journal_entries.journal_id stocke
   * l'UUID — l'ancien filtre comparé au code métier ne matchait jamais
   * (journaux toujours « vides » dans l'UI). Les bornes de dates étaient
   * déclarées mais non supportées par le parser legacy — implémentées.
   */
  async list(workspaceId: string, filters: { journalId?: string; status?: string; startDate?: string; endDate?: string } = {}): Promise<JournalEntry[]> {
    const conds: string[] = ['e.workspace_id::text = $1'];
    const params: any[] = [workspaceId];

    if (filters.journalId) {
      params.push(filters.journalId);
      const n = params.length;
      conds.push(`e.journal_id IN (SELECT j.id FROM journals j WHERE j.id::text = $${n} OR j.journal_id = $${n})`);
    }
    if (filters.status) {
      params.push(filters.status);
      conds.push(`e.status = $${params.length}`);
    }
    if (filters.startDate) {
      params.push(filters.startDate);
      conds.push(`e.entry_date >= $${params.length}::date`);
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      conds.push(`e.entry_date <= $${params.length}::date`);
    }

    const r = await postgresClient.query<any>(
      `SELECT
         e.id,
         e.id            AS "Id",
         e.entry_id      AS "EntryId",
         e.entry_number  AS "EntryNumber",
         e.journal_id    AS "JournalId",
         e.entry_date    AS "EntryDate",
         e.description   AS "Description",
         e.reference     AS "Reference",
         e.status        AS "Status",
         e.posted_at     AS "PostedAt",
         e.validated_at  AS "ValidatedAt",
         e.fiscal_year   AS "FiscalYear",
         e.fiscal_period AS "FiscalPeriod",
         e.workspace_id  AS "WorkspaceId",
         e.created_at    AS "CreatedAt",
         e.updated_at    AS "UpdatedAt"
       FROM journal_entries e
       WHERE ${conds.join(' AND ')}
       ORDER BY e.entry_date DESC, e.entry_number DESC`,
      params
    );
    return r.rows as JournalEntry[];
  }

  async post(entryId: string, postedById: string): Promise<JournalEntry> {
    const entries = await postgresClient.list<JournalEntry>('journal_entries', {
      filterByFormula: `{EntryId} = '${entryId}'`,
    });

    if (entries.length === 0) {
      throw new Error('Écriture non trouvée');
    }

    if (entries[0].Status !== 'draft') {
      throw new Error('Seules les écritures en brouillon peuvent être comptabilisées');
    }

    if (!entries[0].id) {
      throw new Error('ID de l\'écriture manquant');
    }

    return await postgresClient.update<JournalEntry>('journal_entries', entries[0].id, {
      Status: 'posted',
      PostedAt: new Date().toISOString(),
      PostedById: postedById,
      UpdatedAt: new Date().toISOString(),
    });
  }

  async validate(entryId: string, validatedById: string): Promise<JournalEntry> {
    const entries = await postgresClient.list<JournalEntry>('journal_entries', {
      filterByFormula: `{EntryId} = '${entryId}'`,
    });

    if (entries.length === 0) {
      throw new Error('Écriture non trouvée');
    }

    if (entries[0].Status !== 'posted') {
      throw new Error('Seules les écritures comptabilisées peuvent être validées');
    }

    if (!entries[0].id) {
      throw new Error('ID de l\'écriture manquant');
    }

    return await postgresClient.update<JournalEntry>('journal_entries', entries[0].id, {
      Status: 'validated',
      ValidatedAt: new Date().toISOString(),
      ValidatedById: validatedById,
      UpdatedAt: new Date().toISOString(),
    });
  }

  async cancel(entryId: string): Promise<JournalEntry> {
    const entries = await postgresClient.list<JournalEntry>('journal_entries', {
      filterByFormula: `{EntryId} = '${entryId}'`,
    });

    if (entries.length === 0) {
      throw new Error('Écriture non trouvée');
    }

    if (entries[0].Status === 'validated') {
      throw new Error('Une écriture validée ne peut pas être annulée');
    }

    if (!entries[0].id) {
      throw new Error('ID de l\'écriture manquant');
    }

    return await postgresClient.update<JournalEntry>('journal_entries', entries[0].id, {
      Status: 'cancelled',
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Balance générale : agrégat débit/crédit par compte, en UNE requête SQL.
   *
   * L'ancienne implémentation bouclait (N entrées × M lignes × 1 lookup
   * compte) et surtout passait l'ID métier JE-… à getLines dont la colonne
   * est un UUID → « invalid input syntax for type uuid » : balance, bilan
   * et compte de résultat étaient en erreur permanente.
   *
   * Statuts retenus : posted ET validated (une écriture validée reste
   * comptabilisée — l'exclure fausserait la balance).
   */
  async getTrialBalance(workspaceId: string, fiscalYear: number, fiscalPeriod?: number): Promise<TrialBalance[]> {
    const params: any[] = [workspaceId, fiscalYear];
    let periodCond = '';
    if (fiscalPeriod) {
      params.push(fiscalPeriod);
      periodCond = ` AND e.fiscal_period <= $${params.length}`;
    }

    const r = await postgresClient.query<any>(
      `SELECT
         ca.account_number AS number,
         ca.label          AS label,
         SUM(l.debit_amount)::float  AS debit,
         SUM(l.credit_amount)::float AS credit
       FROM journal_entry_lines l
       JOIN journal_entries e ON e.id = l.entry_id
       LEFT JOIN chart_accounts ca ON ca.id = l.account_id
       WHERE e.workspace_id::text = $1
         AND e.status IN ('posted', 'validated')
         AND e.fiscal_year = $2${periodCond}
       GROUP BY ca.account_number, ca.label
       ORDER BY ca.account_number ASC`,
      params
    );

    return r.rows.map((row: any): TrialBalance => ({
      AccountNumber: row.number || 'Inconnu',
      AccountLabel: row.label || 'Compte inconnu',
      OpeningDebit: 0, // TODO: Calculate from previous period
      OpeningCredit: 0,
      PeriodDebit: Number(row.debit || 0),
      PeriodCredit: Number(row.credit || 0),
      ClosingDebit: Number(row.debit || 0),
      ClosingCredit: Number(row.credit || 0),
    }));
  }
}
