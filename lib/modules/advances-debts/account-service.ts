/**
 * Service - Gestion des Comptes (Tiers)
 * Module 7.5 - Avances & Dettes
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Account } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateAccountInput {
  accountType: 'agent' | 'supplier' | 'client' | 'other';
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  workspaceId: string;
}

/**
 * Service de gestion des comptes tiers
 */
export class AccountService {
  /**
   * Liste tous les comptes
   */
  async list(
    workspaceId: string,
    filters?: {
      accountType?: string;
      isActive?: boolean;
    }
  ): Promise<Account[]> {
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.accountType) {
      formula += `, {AccountType} = '${filters.accountType}'`;
    }
    if (filters?.isActive !== undefined) {
      formula += `, {IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`;
    }

    return await airtableClient.list<Account>('Account', {
      filterByFormula: `AND(${formula})`,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Récupère un compte par ID
   */
  async getById(accountId: string): Promise<Account | null> {
    const results = await airtableClient.list<Account>('Account', {
      filterByFormula: `{AccountId} = '${accountId}'`,
    });
    return results[0] || null;
  }

  /**
   * Crée un nouveau compte
   */
  async create(input: CreateAccountInput): Promise<Account> {
    const code = input.code || (await this.generateAccountCode(input.workspaceId, input.accountType));

    const account: Partial<Account> = {
      AccountId: uuidv4(),
      AccountType: input.accountType,
      Name: input.name,
      Code: code,
      Email: input.email,
      Phone: input.phone,
      Address: input.address,
      WorkspaceId: input.workspaceId,
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<Account>('Account', account);

    if (!created) {
      throw new Error('Failed to create account - Airtable not configured');
    }

    return created;
  }

  /**
   * Met à jour un compte
   */
  async update(accountId: string, updates: Partial<Account>): Promise<Account> {
    const records = await airtableClient.list<Account>('Account', {
      filterByFormula: `{AccountId} = '${accountId}'`,
    });

    if (records.length === 0) {
      throw new Error('Compte non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    const updated = await airtableClient.update<Account>('Account', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error('Failed to update account - Airtable not configured');
    }

    return updated;
  }

  /**
   * Désactive un compte
   */
  async deactivate(accountId: string): Promise<Account> {
    return await this.update(accountId, { IsActive: false });
  }

  /**
   * Active un compte
   */
  async activate(accountId: string): Promise<Account> {
    return await this.update(accountId, { IsActive: true });
  }

  /**
   * Recherche de comptes
   */
  async search(workspaceId: string, query: string): Promise<Account[]> {
    const allAccounts = await this.list(workspaceId);
    const lowerQuery = query.toLowerCase();

    return allAccounts.filter(
      (account) =>
        account.Name.toLowerCase().includes(lowerQuery) ||
        account.Code.toLowerCase().includes(lowerQuery) ||
        account.Email?.toLowerCase().includes(lowerQuery) ||
        account.Phone?.includes(query)
    );
  }

  /**
   * Génère un code de compte unique
   */
  private async generateAccountCode(workspaceId: string, accountType: string): Promise<string> {
    const typePrefix: Record<string, string> = {
      agent: 'AGT',
      supplier: 'FRS',
      client: 'CLT',
      other: 'AUT',
    };

    const prefix = typePrefix[accountType] || 'ACC';

    const existingAccounts = await airtableClient.list<Account>('Account', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {AccountType} = '${accountType}')`,
    });

    const sequence = String(existingAccounts.length + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  }
}
