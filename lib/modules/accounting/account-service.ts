/**
 * Service - Gestion du Plan Comptable
 * Module Comptabilité
 */

import { AirtableClient } from '@/lib/airtable/client';
import { ChartAccount } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateAccountInput {
  accountNumber: string;
  label: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountClass: 'class_1' | 'class_2' | 'class_3' | 'class_4' | 'class_5' | 'class_6' | 'class_7' | 'class_8' | 'class_9';
  parentAccountId?: string;
  description?: string;
  allowDirectPosting: boolean;
  workspaceId: string;
}

export class AccountService {
  async create(input: CreateAccountInput): Promise<ChartAccount> {
    const account: Partial<ChartAccount> = {
      AccountId: uuidv4(),
      AccountNumber: input.accountNumber,
      Label: input.label,
      AccountType: input.accountType,
      AccountClass: input.accountClass,
      ParentAccountId: input.parentAccountId,
      Description: input.description,
      IsActive: true,
      AllowDirectPosting: input.allowDirectPosting,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<ChartAccount>('ChartAccount', account);
  }

  async getById(accountId: string): Promise<ChartAccount | null> {
    const accounts = await airtableClient.list<ChartAccount>('ChartAccount', {
      filterByFormula: `{AccountId} = '${accountId}'`,
    });
    return accounts.length > 0 ? accounts[0] : null;
  }

  async getByNumber(accountNumber: string, workspaceId: string): Promise<ChartAccount | null> {
    const accounts = await airtableClient.list<ChartAccount>('ChartAccount', {
      filterByFormula: `AND({AccountNumber} = '${accountNumber}', {WorkspaceId} = '${workspaceId}')`,
    });
    return accounts.length > 0 ? accounts[0] : null;
  }

  async list(workspaceId: string, filters: { accountClass?: string; isActive?: boolean } = {}): Promise<ChartAccount[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.accountClass) {
      filterFormulas.push(`{AccountClass} = '${filters.accountClass}'`);
    }
    if (filters.isActive !== undefined) {
      filterFormulas.push(`{IsActive} = ${filters.isActive ? '1' : '0'}`);
    }

    const filterByFormula = filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<ChartAccount>('ChartAccount', {
      filterByFormula,
      sort: [{ field: 'AccountNumber', direction: 'asc' }],
    });
  }

  async update(accountId: string, updates: Partial<CreateAccountInput>): Promise<ChartAccount> {
    const accounts = await airtableClient.list<ChartAccount>('ChartAccount', {
      filterByFormula: `{AccountId} = '${accountId}'`,
    });

    if (accounts.length === 0) {
      throw new Error('Compte non trouvé');
    }

    const updateData: any = { UpdatedAt: new Date().toISOString() };
    if (updates.label) updateData.Label = updates.label;
    if (updates.description !== undefined) updateData.Description = updates.description;
    if (updates.allowDirectPosting !== undefined) updateData.AllowDirectPosting = updates.allowDirectPosting;

    return await airtableClient.update<ChartAccount>('ChartAccount', (accounts[0] as any)._recordId, updateData);
  }

  async initializeChartOfAccounts(workspaceId: string): Promise<ChartAccount[]> {
    // Plan comptable OHADA simplifié
    const defaultAccounts = [
      { number: '101000', label: 'Capital social', type: 'equity', class: 'class_1' },
      { number: '121000', label: 'Report à nouveau', type: 'equity', class: 'class_1' },
      { number: '201000', label: 'Immobilisations incorporelles', type: 'asset', class: 'class_2' },
      { number: '211000', label: 'Terrains', type: 'asset', class: 'class_2' },
      { number: '241000', label: 'Matériel et mobilier', type: 'asset', class: 'class_2' },
      { number: '301000', label: 'Marchandises', type: 'asset', class: 'class_3' },
      { number: '411000', label: 'Clients', type: 'asset', class: 'class_4' },
      { number: '401000', label: 'Fournisseurs', type: 'liability', class: 'class_4' },
      { number: '421000', label: 'Personnel', type: 'liability', class: 'class_4' },
      { number: '431000', label: 'Sécurité sociale', type: 'liability', class: 'class_4' },
      { number: '521000', label: 'Banques', type: 'asset', class: 'class_5' },
      { number: '571000', label: 'Caisse', type: 'asset', class: 'class_5' },
      { number: '601000', label: 'Achats de marchandises', type: 'expense', class: 'class_6' },
      { number: '604000', label: 'Achats de matières', type: 'expense', class: 'class_6' },
      { number: '621000', label: 'Personnel extérieur', type: 'expense', class: 'class_6' },
      { number: '631000', label: 'Impôts et taxes', type: 'expense', class: 'class_6' },
      { number: '641000', label: 'Charges de personnel', type: 'expense', class: 'class_6' },
      { number: '701000', label: 'Ventes de marchandises', type: 'revenue', class: 'class_7' },
      { number: '706000', label: 'Prestations de services', type: 'revenue', class: 'class_7' },
    ];

    const created: ChartAccount[] = [];
    for (const acc of defaultAccounts) {
      try {
        const account = await this.create({
          accountNumber: acc.number,
          label: acc.label,
          accountType: acc.type as any,
          accountClass: acc.class as any,
          allowDirectPosting: true,
          workspaceId,
        });
        created.push(account);
      } catch (error) {
        console.error(`Error creating account ${acc.number}:`, error);
      }
    }

    return created;
  }
}
