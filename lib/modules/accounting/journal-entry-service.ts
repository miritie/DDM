/**
 * Service - Gestion des Écritures Comptables
 * Module Comptabilité
 */

import { AirtableClient } from '@/lib/airtable/client';
import { JournalEntry, JournalEntryLine, AccountBalance, TrialBalance, Journal, ChartAccount } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
    const entries = await airtableClient.list<JournalEntry>('JournalEntry', {
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
    const journal = await airtableClient.list<Journal>('Journal', {
      filterByFormula: `{JournalId} = '${input.journalId}'`,
    });
    const journalCode = journal[0]?.Code || 'OD';

    const entryNumber = await this.generateEntryNumber(journalCode, input.workspaceId);

    const entry: Partial<JournalEntry> = {
      EntryId: uuidv4(),
      EntryNumber: entryNumber,
      JournalId: input.journalId,
      EntryDate: input.entryDate,
      Description: input.description,
      Reference: input.reference,
      Status: 'draft',
      FiscalYear: fiscalYear,
      FiscalPeriod: fiscalPeriod,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdEntry = await airtableClient.create<JournalEntry>('JournalEntry', entry);

    if (!createdEntry) {
      throw new Error('Failed to create journal entry - Airtable not configured');
    }

    // Create lines
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      const entryLine: Partial<JournalEntryLine> = {
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

      await airtableClient.create<JournalEntryLine>('JournalEntryLine', entryLine);
    }

    return createdEntry;
  }

  async getById(entryId: string): Promise<JournalEntry | null> {
    const entries = await airtableClient.list<JournalEntry>('JournalEntry', {
      filterByFormula: `{EntryId} = '${entryId}'`,
    });
    return entries.length > 0 ? entries[0] : null;
  }

  async getLines(entryId: string): Promise<JournalEntryLine[]> {
    return await airtableClient.list<JournalEntryLine>('JournalEntryLine', {
      filterByFormula: `{EntryId} = '${entryId}'`,
      sort: [{ field: 'LineNumber', direction: 'asc' }],
    });
  }

  async list(workspaceId: string, filters: { journalId?: string; status?: string; startDate?: string; endDate?: string } = {}): Promise<JournalEntry[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.journalId) filterFormulas.push(`{JournalId} = '${filters.journalId}'`);
    if (filters.status) filterFormulas.push(`{Status} = '${filters.status}'`);
    if (filters.startDate) filterFormulas.push(`{EntryDate} >= '${filters.startDate}'`);
    if (filters.endDate) filterFormulas.push(`{EntryDate} <= '${filters.endDate}'`);

    const filterByFormula = filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<JournalEntry>('JournalEntry', {
      filterByFormula,
      sort: [{ field: 'EntryDate', direction: 'desc' }],
    });
  }

  async post(entryId: string, postedById: string): Promise<JournalEntry> {
    const entries = await airtableClient.list<JournalEntry>('JournalEntry', {
      filterByFormula: `{EntryId} = '${entryId}'`,
    });

    if (entries.length === 0) {
      throw new Error('Écriture non trouvée');
    }

    if (entries[0].Status !== 'draft') {
      throw new Error('Seules les écritures en brouillon peuvent être comptabilisées');
    }

    const updated = await airtableClient.update<JournalEntry>('JournalEntry', (entries[0] as any)._recordId, {
      Status: 'posted',
      PostedAt: new Date().toISOString(),
      PostedById: postedById,
      UpdatedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error('Failed to post journal entry - Airtable not configured');
    }

    return updated;
  }

  async validate(entryId: string, validatedById: string): Promise<JournalEntry> {
    const entries = await airtableClient.list<JournalEntry>('JournalEntry', {
      filterByFormula: `{EntryId} = '${entryId}'`,
    });

    if (entries.length === 0) {
      throw new Error('Écriture non trouvée');
    }

    if (entries[0].Status !== 'posted') {
      throw new Error('Seules les écritures comptabilisées peuvent être validées');
    }

    const updated = await airtableClient.update<JournalEntry>('JournalEntry', (entries[0] as any)._recordId, {
      Status: 'validated',
      ValidatedAt: new Date().toISOString(),
      ValidatedById: validatedById,
      UpdatedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error('Failed to validate journal entry - Airtable not configured');
    }

    return updated;
  }

  async cancel(entryId: string): Promise<JournalEntry> {
    const entries = await airtableClient.list<JournalEntry>('JournalEntry', {
      filterByFormula: `{EntryId} = '${entryId}'`,
    });

    if (entries.length === 0) {
      throw new Error('Écriture non trouvée');
    }

    if (entries[0].Status === 'validated') {
      throw new Error('Une écriture validée ne peut pas être annulée');
    }

    const updated = await airtableClient.update<JournalEntry>('JournalEntry', (entries[0] as any)._recordId, {
      Status: 'cancelled',
      UpdatedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error('Failed to cancel journal entry - Airtable not configured');
    }

    return updated;
  }

  async getTrialBalance(workspaceId: string, fiscalYear: number, fiscalPeriod?: number): Promise<TrialBalance[]> {
    // Get all posted/validated entries for the period
    const filters: any = { status: 'posted' };
    const entries = await this.list(workspaceId, filters);

    const periodEntries = entries.filter(
      (e) => e.FiscalYear === fiscalYear && (!fiscalPeriod || e.FiscalPeriod <= fiscalPeriod)
    );

    // Get all lines for these entries
    const accountBalances: Record<string, { debit: number; credit: number; label: string; number: string }> = {};

    for (const entry of periodEntries) {
      const lines = await this.getLines(entry.EntryId);

      for (const line of lines) {
        const account = await airtableClient.list<ChartAccount>('ChartAccount', {
          filterByFormula: `{AccountId} = '${line.AccountId}'`,
        });

        const accountNumber = account[0]?.AccountNumber || 'Unknown';
        const accountLabel = account[0]?.Label || 'Unknown';

        if (!accountBalances[accountNumber]) {
          accountBalances[accountNumber] = {
            debit: 0,
            credit: 0,
            label: accountLabel,
            number: accountNumber,
          };
        }

        accountBalances[accountNumber].debit += line.DebitAmount;
        accountBalances[accountNumber].credit += line.CreditAmount;
      }
    }

    // Convert to TrialBalance format
    const trialBalance: TrialBalance[] = Object.entries(accountBalances).map(([number, data]) => ({
      AccountNumber: number,
      AccountLabel: data.label,
      OpeningDebit: 0, // TODO: Calculate from previous period
      OpeningCredit: 0,
      PeriodDebit: data.debit,
      PeriodCredit: data.credit,
      ClosingDebit: data.debit,
      ClosingCredit: data.credit,
    }));

    return trialBalance.sort((a, b) => a.AccountNumber.localeCompare(b.AccountNumber));
  }
}
