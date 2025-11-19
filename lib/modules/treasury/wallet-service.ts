/**
 * Service - Gestion des Wallets (Portefeuilles)
 * Module 7.3 - Trésorerie Multi-wallet
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Wallet, WalletType, WalletStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateWalletInput {
  name: string;
  type: WalletType;
  currency?: string;
  initialBalance?: number;
  bankName?: string;
  accountNumber?: string;
  description?: string;
  workspaceId: string;
}

/**
 * Service de gestion des wallets (portefeuilles)
 */
export class WalletService {
  /**
   * Liste tous les wallets
   */
  async list(
    workspaceId: string,
    filters?: {
      type?: WalletType;
      status?: WalletStatus;
      isActive?: boolean;
    }
  ): Promise<Wallet[]> {
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.type) {
      formula += `, {Type} = '${filters.type}'`;
    }
    if (filters?.status) {
      formula += `, {Status} = '${filters.status}'`;
    }
    if (filters?.isActive !== undefined) {
      formula += `, {IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`;
    }

    return await airtableClient.list<Wallet>('Wallet', {
      filterByFormula: `AND(${formula})`,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Récupère un wallet par ID
   */
  async getById(walletId: string): Promise<Wallet | null> {
    const results = await airtableClient.list<Wallet>('Wallet', {
      filterByFormula: `{WalletId} = '${walletId}'`,
    });
    return results[0] || null;
  }

  /**
   * Crée un nouveau wallet
   */
  async create(input: CreateWalletInput): Promise<Wallet> {
    const code = await this.generateWalletCode(input.workspaceId, input.type);

    const wallet: Partial<Wallet> = {
      WalletId: uuidv4(),
      Name: input.name,
      Code: code,
      Type: input.type,
      Currency: input.currency || 'XOF',
      Balance: input.initialBalance || 0,
      InitialBalance: input.initialBalance || 0,
      BankName: input.bankName,
      AccountNumber: input.accountNumber,
      Description: input.description,
      Status: 'active',
      WorkspaceId: input.workspaceId,
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<Wallet>('Wallet', wallet);
    if (!created) {
      throw new Error('Failed to create wallet - Airtable not configured');
    }
    return created;
  }

  /**
   * Met à jour un wallet
   */
  async update(walletId: string, updates: Partial<Wallet>): Promise<Wallet> {
    const wallet = await this.getById(walletId);
    if (!wallet) {
      throw new Error('Wallet non trouvé');
    }

    const records = await airtableClient.list<Wallet>('Wallet', {
      filterByFormula: `{WalletId} = '${walletId}'`,
    });

    if (records.length === 0) {
      throw new Error('Wallet non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    const updated = await airtableClient.update<Wallet>('Wallet', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update wallet - Airtable not configured');
    }
    return updated;
  }

  /**
   * Met à jour le solde d'un wallet
   */
  async updateBalance(walletId: string, amount: number, operation: 'add' | 'subtract'): Promise<Wallet> {
    const wallet = await this.getById(walletId);
    if (!wallet) {
      throw new Error('Wallet non trouvé');
    }

    const newBalance = operation === 'add'
      ? wallet.Balance + amount
      : wallet.Balance - amount;

    if (newBalance < 0) {
      throw new Error('Solde insuffisant');
    }

    return await this.update(walletId, { Balance: newBalance });
  }

  /**
   * Désactive un wallet
   */
  async deactivate(walletId: string): Promise<Wallet> {
    return await this.update(walletId, {
      IsActive: false,
      Status: 'inactive',
    });
  }

  /**
   * Active un wallet
   */
  async activate(walletId: string): Promise<Wallet> {
    return await this.update(walletId, {
      IsActive: true,
      Status: 'active',
    });
  }

  /**
   * Clôture un wallet
   */
  async close(walletId: string): Promise<Wallet> {
    const wallet = await this.getById(walletId);
    if (!wallet) {
      throw new Error('Wallet non trouvé');
    }

    if (wallet.Balance !== 0) {
      throw new Error('Impossible de clôturer un wallet avec un solde non nul');
    }

    return await this.update(walletId, {
      Status: 'closed',
      IsActive: false,
    });
  }

  /**
   * Récupère les soldes de tous les wallets actifs
   */
  async getBalances(workspaceId: string): Promise<Array<{
    walletId: string;
    walletName: string;
    balance: number;
    currency: string;
  }>> {
    const wallets = await this.list(workspaceId, { isActive: true });

    return wallets.map((wallet) => ({
      walletId: wallet.WalletId,
      walletName: wallet.Name,
      balance: wallet.Balance,
      currency: wallet.Currency,
    }));
  }

  /**
   * Calcule le solde total (tous wallets)
   */
  async getTotalBalance(workspaceId: string): Promise<number> {
    const wallets = await this.list(workspaceId, { isActive: true });
    return wallets.reduce((sum, wallet) => sum + wallet.Balance, 0);
  }

  /**
   * Génère un code de wallet unique
   */
  private async generateWalletCode(workspaceId: string, type: WalletType): Promise<string> {
    const typePrefix: Record<WalletType, string> = {
      cash: 'CASH',
      bank: 'BANK',
      mobile_money: 'MOMO',
      other: 'WLLT',
    };

    const prefix = typePrefix[type];

    const existingWallets = await airtableClient.list<Wallet>('Wallet', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Type} = '${type}')`,
    });

    const sequence = String(existingWallets.length + 1).padStart(3, '0');
    return `${prefix}-${sequence}`;
  }
}
