/**
 * Service - Gestion des Transactions
 * Module 7.3 - Trésorerie Multi-wallet
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Transaction, TransactionType, TransactionCategory, TransactionStatus, TreasuryStatistics } from '@/types/modules';
import { WalletService } from './wallet-service';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();
const walletService = new WalletService();

export interface CreateTransactionInput {
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  sourceWalletId?: string;
  destinationWalletId?: string;
  description: string;
  reference?: string;
  attachmentUrl?: string;
  processedById: string;
  workspaceId: string;
}

/**
 * Service de gestion des transactions
 */
export class TransactionService {
  /**
   * Liste toutes les transactions
   */
  async list(
    workspaceId: string,
    filters?: {
      type?: TransactionType;
      category?: TransactionCategory;
      status?: TransactionStatus;
      walletId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Transaction[]> {
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.type) {
      formula += `, {Type} = '${filters.type}'`;
    }
    if (filters?.category) {
      formula += `, {Category} = '${filters.category}'`;
    }
    if (filters?.status) {
      formula += `, {Status} = '${filters.status}'`;
    }
    if (filters?.walletId) {
      formula += `, OR({SourceWalletId} = '${filters.walletId}', {DestinationWalletId} = '${filters.walletId}')`;
    }

    return await airtableClient.list<Transaction>('Transaction', {
      filterByFormula: `AND(${formula})`,
      sort: [{ field: 'ProcessedAt', direction: 'desc' }],
    });
  }

  /**
   * Récupère une transaction par ID
   */
  async getById(transactionId: string): Promise<Transaction | null> {
    const results = await airtableClient.list<Transaction>('Transaction', {
      filterByFormula: `{TransactionId} = '${transactionId}'`,
    });
    return results[0] || null;
  }

  /**
   * Crée une transaction de revenus (income)
   */
  async createIncome(input: CreateTransactionInput): Promise<Transaction> {
    if (!input.destinationWalletId) {
      throw new Error('Le wallet de destination est requis pour un revenu');
    }

    // Créer la transaction
    const transaction = await this.createTransaction({
      ...input,
      type: 'income',
    });

    // Mettre à jour le solde du wallet
    await walletService.updateBalance(input.destinationWalletId, input.amount, 'add');

    return transaction;
  }

  /**
   * Crée une transaction de dépense (expense)
   */
  async createExpense(input: CreateTransactionInput): Promise<Transaction> {
    if (!input.sourceWalletId) {
      throw new Error('Le wallet source est requis pour une dépense');
    }

    // Vérifier le solde
    const wallet = await walletService.getById(input.sourceWalletId);
    if (!wallet) {
      throw new Error('Wallet source non trouvé');
    }

    if (wallet.Balance < input.amount) {
      throw new Error('Solde insuffisant');
    }

    // Créer la transaction
    const transaction = await this.createTransaction({
      ...input,
      type: 'expense',
    });

    // Mettre à jour le solde du wallet
    await walletService.updateBalance(input.sourceWalletId, input.amount, 'subtract');

    return transaction;
  }

  /**
   * Crée une transaction de transfert
   */
  async createTransfer(input: CreateTransactionInput): Promise<Transaction> {
    if (!input.sourceWalletId || !input.destinationWalletId) {
      throw new Error('Les wallets source et destination sont requis pour un transfert');
    }

    if (input.sourceWalletId === input.destinationWalletId) {
      throw new Error('Les wallets source et destination doivent être différents');
    }

    // Vérifier le solde du wallet source
    const sourceWallet = await walletService.getById(input.sourceWalletId);
    if (!sourceWallet) {
      throw new Error('Wallet source non trouvé');
    }

    if (sourceWallet.Balance < input.amount) {
      throw new Error('Solde insuffisant dans le wallet source');
    }

    // Créer la transaction
    const transaction = await this.createTransaction({
      ...input,
      type: 'transfer',
      category: 'transfer',
    });

    // Mettre à jour les soldes
    await walletService.updateBalance(input.sourceWalletId, input.amount, 'subtract');
    await walletService.updateBalance(input.destinationWalletId, input.amount, 'add');

    return transaction;
  }

  /**
   * Annule une transaction
   */
  async cancel(transactionId: string): Promise<Transaction> {
    const transaction = await this.getById(transactionId);
    if (!transaction) {
      throw new Error('Transaction non trouvée');
    }

    if (transaction.Status === 'cancelled') {
      throw new Error('Transaction déjà annulée');
    }

    // Annuler les mouvements selon le type
    if (transaction.Type === 'income' && transaction.DestinationWalletId) {
      await walletService.updateBalance(transaction.DestinationWalletId, transaction.Amount, 'subtract');
    } else if (transaction.Type === 'expense' && transaction.SourceWalletId) {
      await walletService.updateBalance(transaction.SourceWalletId, transaction.Amount, 'add');
    } else if (transaction.Type === 'transfer') {
      if (transaction.SourceWalletId && transaction.DestinationWalletId) {
        await walletService.updateBalance(transaction.SourceWalletId, transaction.Amount, 'add');
        await walletService.updateBalance(transaction.DestinationWalletId, transaction.Amount, 'subtract');
      }
    }

    // Mettre à jour le statut
    return await this.update(transactionId, {
      Status: 'cancelled',
    });
  }

  /**
   * Met à jour une transaction
   */
  async update(transactionId: string, updates: Partial<Transaction>): Promise<Transaction> {
    const records = await airtableClient.list<Transaction>('Transaction', {
      filterByFormula: `{TransactionId} = '${transactionId}'`,
    });

    if (records.length === 0) {
      throw new Error('Transaction non trouvée');
    }

    const recordId = (records[0] as any)._recordId;

    return await airtableClient.update<Transaction>('Transaction', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Récupère les statistiques
   */
  async getStatistics(workspaceId: string, period?: { startDate: string; endDate: string }): Promise<TreasuryStatistics> {
    const transactions = await this.list(workspaceId, {
      status: 'completed',
    });

    const wallets = await walletService.list(workspaceId, { isActive: true });

    const totalIncome = transactions
      .filter((t) => t.Type === 'income')
      .reduce((sum, t) => sum + t.Amount, 0);

    const totalExpense = transactions
      .filter((t) => t.Type === 'expense')
      .reduce((sum, t) => sum + t.Amount, 0);

    const totalTransfers = transactions
      .filter((t) => t.Type === 'transfer')
      .reduce((sum, t) => sum + t.Amount, 0);

    const totalBalance = wallets.reduce((sum, w) => sum + w.Balance, 0);

    const walletBalances = wallets.map((w) => ({
      WalletId: w.WalletId,
      WalletName: w.Name,
      Balance: w.Balance,
      Currency: w.Currency,
    }));

    return {
      totalBalance,
      totalIncome,
      totalExpense,
      totalTransfers,
      walletsCount: wallets.length,
      transactionsCount: transactions.length,
      walletBalances,
    };
  }

  /**
   * Crée une transaction (méthode privée)
   */
  private async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const transactionNumber = await this.generateTransactionNumber(input.workspaceId, input.type);

    const transaction: Partial<Transaction> = {
      TransactionId: uuidv4(),
      TransactionNumber: transactionNumber,
      Type: input.type,
      Category: input.category,
      Amount: input.amount,
      SourceWalletId: input.sourceWalletId,
      DestinationWalletId: input.destinationWalletId,
      Description: input.description,
      Reference: input.reference,
      AttachmentUrl: input.attachmentUrl,
      Status: 'completed',
      ProcessedById: input.processedById,
      ProcessedAt: new Date().toISOString(),
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<Transaction>('Transaction', transaction);
  }

  /**
   * Génère un numéro de transaction unique
   */
  private async generateTransactionNumber(workspaceId: string, type: TransactionType): Promise<string> {
    const typePrefix: Record<TransactionType, string> = {
      income: 'INC',
      expense: 'EXP',
      transfer: 'TRF',
    };

    const prefix = typePrefix[type];
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const existingTransactions = await airtableClient.list<Transaction>('Transaction', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Type} = '${type}')`,
    });

    const sequence = String(existingTransactions.length + 1).padStart(4, '0');
    return `${prefix}-${year}${month}-${sequence}`;
  }
}
