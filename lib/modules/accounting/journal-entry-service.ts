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

  async list(workspaceId: string, filters: { journalId?: string; status?: string; startDate?: string; endDate?: string } = {}): Promise<JournalEntry[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.journalId) filterFormulas.push(`{JournalId} = '${filters.journalId}'`);
    if (filters.status) filterFormulas.push(`{Status} = '${filters.status}'`);
    if (filters.startDate) filterFormulas.push(`{EntryDate} >= '${filters.startDate}'`);
    if (filters.endDate) filterFormulas.push(`{EntryDate} <= '${filters.endDate}'`);

    const filterByFormula = filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await postgresClient.list<JournalEntry>('journal_entries', {
      filterByFormula,
      sort: [{ field: 'EntryDate', direction: 'desc' }],
    });
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
