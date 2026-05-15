/**
 * Service - Gestion des Wallets (Portefeuilles)
 * Module 7.3 - Trésorerie Multi-wallet
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Wallet, WalletType, WalletStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

// SQL direct pour les hot paths : le mapper PascalCase legacy de
// postgres-client renomme `id` en `Id` ET le parser filterByFormula
// ne reconnaît pas le pattern `wallet_id = '...'` sans accolades →
// plante en silence. On contourne en SQL direct via pool.query().
const db = postgresClient as any;

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
   * Récupère un wallet par ID (slug `wallet_id` ou UUID interne).
   * SQL direct (le filterByFormula legacy ne reconnaît pas ce pattern et
   * renvoie alors toutes les lignes en silence — bug critique).
   */
  async getById(walletId: string): Promise<Wallet | null> {
    const r = await db.query(
      `SELECT
         id,
         wallet_id        AS "WalletId",
         name             AS "Name",
         code             AS "Code",
         type             AS "Type",
         currency         AS "Currency",
         balance          AS "Balance",
         initial_balance  AS "InitialBalance",
         bank_name        AS "BankName",
         account_number   AS "AccountNumber",
         description      AS "Description",
         status           AS "Status",
         is_active        AS "IsActive",
         workspace_id     AS "WorkspaceId",
         chart_account_id AS "ChartAccountId",
         created_at       AS "CreatedAt",
         updated_at       AS "UpdatedAt"
       FROM wallets
       WHERE id::text = $1 OR wallet_id = $1
       LIMIT 1`,
      [walletId]
    );
    if (r.rows.length === 0) return null;
    // On force la présence du champ Id (utilisé par certains callers legacy)
    return { ...r.rows[0], Id: r.rows[0].id } as any;
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
   * Met à jour un wallet (SQL direct — le path legacy via postgres-client
   * était cassé : record.id renvoyait undefined à cause du mapper PascalCase).
   */
  async update(walletId: string, updates: Partial<Wallet> & { ChartAccountId?: string | null }): Promise<Wallet> {
    const wallet = await this.getById(walletId);
    if (!wallet) {
      throw new Error('Wallet non trouvé');
    }

    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];
    const push = (col: string, v: any) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (updates.Name !== undefined) push('name', updates.Name);
    if (updates.Description !== undefined) push('description', updates.Description);
    if (updates.BankName !== undefined) push('bank_name', updates.BankName);
    if (updates.AccountNumber !== undefined) push('account_number', updates.AccountNumber);
    if (updates.Balance !== undefined) push('balance', updates.Balance);
    if (updates.Status !== undefined) push('status', updates.Status);
    if (updates.IsActive !== undefined) push('is_active', updates.IsActive);
    if ((updates as any).ChartAccountId !== undefined) push('chart_account_id', (updates as any).ChartAccountId);

    if (sets.length === 1) {
      // Rien à mettre à jour
      return wallet;
    }

    params.push((wallet as any).id);
    await db.query(
      `UPDATE wallets SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );
    const updated = await this.getById(walletId);
    return updated!;
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
