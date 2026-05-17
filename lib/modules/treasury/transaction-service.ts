/**
 * Service - Gestion des Transactions
 * Module 7.3 - Trésorerie Multi-wallet
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Transaction, TransactionType, TransactionCategory, TransactionStatus, TreasuryStatistics } from '@/types/modules';
import { WalletService } from './wallet-service';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();
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
  expenseId?: string;  // FK optionnelle : lie la transaction à une dépense (paiement multi-wallet)
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
    const conditions: string[] = [`workspace_id = '${workspaceId}'`];

    if (filters?.type) {
      conditions.push(`type = '${filters.type}'`);
    }
    if (filters?.category) {
      conditions.push(`category = '${filters.category}'`);
    }
    if (filters?.status) {
      conditions.push(`status = '${filters.status}'`);
    }
    if (filters?.walletId) {
      conditions.push(`(source_wallet_id = '${filters.walletId}' OR destination_wallet_id = '${filters.walletId}')`);
    }

    return await postgresClient.list<Transaction>('transactions', {
      filterByFormula: conditions.join(' AND '),
      orderBy: { field: 'processed_at', direction: 'desc' },
    });
  }

  /**
   * Récupère une transaction par ID
   */
  async getById(transactionId: string): Promise<Transaction | null> {
    const results = await postgresClient.list<Transaction>('transactions', {
      filterByFormula: `transaction_id = '${transactionId}'`,
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
    const records = await postgresClient.list<Transaction>('transactions', {
      filterByFormula: `transaction_id = '${transactionId}'`,
    });

    if (records.length === 0) {
      throw new Error('Transaction non trouvée');
    }

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('Transaction ID non trouvé');
    }

    const updateData: Record<string, any> = {
      UpdatedAt: new Date().toISOString(),
    };

    // Map updates to PascalCase
    if (updates.Status !== undefined) updateData.Status = updates.Status;
    if (updates.Description !== undefined) updateData.Description = updates.Description;
    if (updates.Reference !== undefined) updateData.Reference = updates.Reference;

    const updated = await postgresClient.update<Transaction>('transactions', recordId, updateData);

    return updated;
  }

  /**
   * Récupère les statistiques
   */
  async getStatistics(workspaceId: string, period?: { startDate: string; endDate: string }): Promise<TreasuryStatistics> {
    const transactions = await this.list(workspaceId, {
      status: 'completed',
    });

    const wallets = await walletService.list(workspaceId, { isActive: true });

    // Sécurité : Postgres NUMERIC peut arriver en string côté JS via pg.
    // Sans Number(), "100" + 50 = "10050" puis le reduce devient NaN au
    // moment d'un + undefined. Coerce systématiquement, défaut 0.
    const num = (v: any): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // Sémantique métier des KPIs :
    // - Revenus  = encaissements liés à de vraies entrées d'argent (ventes
    //              sur stands, paiements clients, etc.). On EXCLUT les
    //              ajustements d'inventaire wallet qui sont des corrections
    //              de solde et non des revenus opérationnels.
    // - Dépenses = décaissements liés à de vraies sorties (paiement de
    //              sollicitations validées). On EXCLUT aussi les ajustements.
    // - Transferts = mouvements internes wallet ↔ wallet (sans impact sur
    //                le solde total).
    // Les ajustements (category='adjustment') impactent le solde mais
    // n'apparaissent dans aucun KPI : ce sont des corrections comptables.
    const isAdjustment = (t: any) => t.Category === 'adjustment';

    const totalIncome = transactions
      .filter((t) => t.Type === 'income' && !isAdjustment(t))
      .reduce((sum, t) => sum + num(t.Amount), 0);

    const totalExpense = transactions
      .filter((t) => t.Type === 'expense' && !isAdjustment(t))
      .reduce((sum, t) => sum + num(t.Amount), 0);

    const totalTransfers = transactions
      .filter((t) => t.Type === 'transfer')
      .reduce((sum, t) => sum + num(t.Amount), 0);

    // Ajustements (corrections d'inventaire wallet). On le sépare des
    // Revenus/Dépenses pour préserver la sémantique « vraie vente / vraie
    // sortie », mais on l'expose comme KPI à part pour que l'équation
    // Solde = Solde initial + Revenus + Ajustements − Dépenses soit lisible.
    const adjIn = transactions
      .filter((t) => t.Type === 'income' && isAdjustment(t))
      .reduce((sum, t) => sum + num(t.Amount), 0);
    const adjOut = transactions
      .filter((t) => t.Type === 'expense' && isAdjustment(t))
      .reduce((sum, t) => sum + num(t.Amount), 0);
    const totalAdjustments = adjIn - adjOut;

    const totalBalance = wallets.reduce((sum, w) => sum + num(w.Balance), 0);
    const totalInitialBalance = wallets.reduce((sum, w) => sum + num((w as any).InitialBalance), 0);

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
      totalAdjustments,
      totalInitialBalance,
      walletsCount: wallets.length,
      transactionsCount: transactions.length,
      walletBalances,
    };
  }

  /**
   * Crée une transaction (méthode privée)
   *
   * processedById peut être soit l'UUID PK (users.id), soit le business code
   * (users.user_id = "USR-…"). Convention de l'app : la session véhicule le
   * business code via getCurrentUserId(). On résout ici pour éviter
   * "invalid input syntax for type uuid" sur transactions.processed_by_id.
   */
  private async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const transactionNumber = await this.generateTransactionNumber(input.workspaceId, input.type);

    const processedByUuid = await this.resolveUserUuid(input.processedById);

    const transaction: Partial<Transaction> & { ExpenseId?: string } = {
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
      ProcessedById: processedByUuid,
      ProcessedAt: new Date().toISOString(),
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      ...(input.expenseId ? { ExpenseId: input.expenseId } : {}),
    };

    const created = await postgresClient.create<Transaction>('transactions', transaction);
    return created;
  }

  /** Accepte UUID PK ou business code user_id et retourne l'UUID PK. */
  private async resolveUserUuid(idOrSlug: string): Promise<string> {
    const r = await postgresClient.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    if (r.rows.length === 0) throw new Error('Utilisateur introuvable');
    return r.rows[0].id;
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

    const existingTransactions = await postgresClient.list<Transaction>('transactions', {
      filterByFormula: `workspace_id = '${workspaceId}' AND type = '${type}'`,
    });

    const sequence = String(existingTransactions.length + 1).padStart(4, '0');
    return `${prefix}-${year}${month}-${sequence}`;
  }
}
