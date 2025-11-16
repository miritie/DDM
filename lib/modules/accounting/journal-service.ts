/**
 * Service - Gestion des Journaux Comptables
 * Module Comptabilité
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Journal } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateJournalInput {
  code: string;
  label: string;
  journalType: 'sales' | 'purchases' | 'bank' | 'cash' | 'operations' | 'payroll';
  description?: string;
  workspaceId: string;
}

export class JournalService {
  async create(input: CreateJournalInput): Promise<Journal> {
    const journal: Partial<Journal> = {
      JournalId: uuidv4(),
      Code: input.code,
      Label: input.label,
      JournalType: input.journalType,
      Description: input.description,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<Journal>('Journal', journal);
  }

  async getById(journalId: string): Promise<Journal | null> {
    const journals = await airtableClient.list<Journal>('Journal', {
      filterByFormula: `{JournalId} = '${journalId}'`,
    });
    return journals.length > 0 ? journals[0] : null;
  }

  async list(workspaceId: string): Promise<Journal[]> {
    return await airtableClient.list<Journal>('Journal', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
      sort: [{ field: 'Code', direction: 'asc' }],
    });
  }

  async initializeDefaultJournals(workspaceId: string): Promise<Journal[]> {
    const defaultJournals = [
      { code: 'VT', label: 'Journal des ventes', type: 'sales' as const },
      { code: 'AC', label: 'Journal des achats', type: 'purchases' as const },
      { code: 'BQ', label: 'Journal de banque', type: 'bank' as const },
      { code: 'CA', label: 'Journal de caisse', type: 'cash' as const },
      { code: 'OD', label: 'Opérations diverses', type: 'operations' as const },
      { code: 'PAI', label: 'Journal de paie', type: 'payroll' as const },
    ];

    const created: Journal[] = [];
    for (const j of defaultJournals) {
      try {
        const journal = await this.create({
          code: j.code,
          label: j.label,
          journalType: j.type,
          workspaceId,
        });
        created.push(journal);
      } catch (error) {
        console.error(`Error creating journal ${j.code}:`, error);
      }
    }

    return created;
  }
}
