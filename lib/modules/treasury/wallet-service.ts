/**
 * Service - Gestion des Wallets (Portefeuilles)
 * Module 7.3 - Trésorerie Multi-wallet
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Wallet, WalletType, WalletStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

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
    const conditions: string[] = [`workspace_id = '${workspaceId}'`];
    const params: any[] = [];

    if (filters?.type) {
      conditions.push(`type = '${filters.type}'`);
    }
    if (filters?.status) {
      conditions.push(`status = '${filters.status}'`);
    }
    if (filters?.isActive !== undefined) {
      conditions.push(`is_active = ${filters.isActive}`);
    }

    const records = await postgresClient.list<Wallet>('wallets', {
      filterByFormula: conditions.join(' AND '),
      orderBy: { field: 'name', direction: 'asc' },
    });

    return records;
  }

  /**
   * Récupère un wallet par ID
   */
  async getById(walletId: string): Promise<Wallet | null> {
    const results = await postgresClient.list<Wallet>('wallets', {
      filterByFormula: `wallet_id = '${walletId}'`,
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

    const created = await postgresClient.create<Wallet>('wallets', wallet);
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

    const records = await postgresClient.list<Wallet>('wallets', {
      filterByFormula: `wallet_id = '${walletId}'`,
    });

    if (records.length === 0) {
      throw new Error('Wallet non trouvé');
    }

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('Wallet ID non trouvé');
    }

    const updateData: Record<string, any> = {
      UpdatedAt: new Date().toISOString(),
    };

    // Map updates to PascalCase
    if (updates.Name !== undefined) updateData.Name = updates.Name;
    if (updates.Description !== undefined) updateData.Description = updates.Description;
    if (updates.BankName !== undefined) updateData.BankName = updates.BankName;
    if (updates.AccountNumber !== undefined) updateData.AccountNumber = updates.AccountNumber;
    if (updates.Balance !== undefined) updateData.Balance = updates.Balance;
    if (updates.Status !== undefined) updateData.Status = updates.Status;
    if (updates.IsActive !== undefined) updateData.IsActive = updates.IsActive;

    const updated = await postgresClient.update<Wallet>('wallets', recordId, updateData);
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

    const existingWallets = await postgresClient.list<Wallet>('wallets', {
      filterByFormula: `workspace_id = '${workspaceId}' AND type = '${type}'`,
    });

    const sequence = String(existingWallets.length + 1).padStart(3, '0');
    return `${prefix}-${sequence}`;
  }
}
