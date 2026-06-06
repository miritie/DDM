/**
 * Service - Gestion des Transactions
 * Module 7.3 - Trésorerie Multi-wallet
 *
 * Réécrit en SQL direct paramétré : l'ancien chemin via
 * postgresClient.list(filterByFormula) passait des conditions sans accolades
 * que le parser legacy ne reconnaissait pas → le WHERE était silencieusement
 * abandonné. Conséquences réelles : list() renvoyait TOUTES les transactions
 * (tous workspaces, tous statuts), getById() renvoyait la première ligne
 * arbitraire de la table, et cancel() inversait donc les soldes wallet d'une
 * transaction au hasard avant d'échouer sur update().
 *
 * Toutes les opérations qui touchent un solde wallet sont désormais
 * transactionnelles (BEGIN/COMMIT) avec verrou de ligne (FOR UPDATE) :
 * plus d'incohérence « transaction créée mais solde non mis à jour », plus
 * de race condition entre la vérification du solde et son débit.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Transaction, TransactionType, TransactionCategory, TransactionStatus, TreasuryStatistics } from '@/types/modules';
import { WalletService } from './wallet-service';
import { nextDocSequence, Queryable } from '@/lib/database/doc-counters';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/http/api-error';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();
const walletService = new WalletService();

/**
 * Colonnes exposées en PascalCase — même forme que l'ancien mapper
 * (mapRowToPascalCase) pour ne rien casser côté frontend. `Amount` est
 * casté en float : pg renvoie NUMERIC en string, ce qui cassait les
 * additions côté client ("100" + 50 → "10050").
 */
/** Colonnes préfixables par un alias de table (jointures → ambiguïté). */
const txColumns = (p = '') => `
  ${p}id,
  ${p}id                    AS "Id",
  ${p}transaction_id        AS "TransactionId",
  ${p}transaction_number    AS "TransactionNumber",
  ${p}type                  AS "Type",
  ${p}category              AS "Category",
  ${p}amount::float         AS "Amount",
  ${p}source_wallet_id      AS "SourceWalletId",
  ${p}destination_wallet_id AS "DestinationWalletId",
  ${p}description           AS "Description",
  ${p}reference             AS "Reference",
  ${p}attachment_url        AS "AttachmentUrl",
  ${p}status                AS "Status",
  ${p}processed_by_id       AS "ProcessedById",
  ${p}processed_at          AS "ProcessedAt",
  ${p}workspace_id          AS "WorkspaceId",
  ${p}created_at            AS "CreatedAt",
  ${p}updated_at            AS "UpdatedAt"
`;
const TX_COLUMNS = txColumns();

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

interface LockedWallet {
  id: string;
  name: string;
  balance: number;
}

/**
 * Service de gestion des transactions
 */
export class TransactionService {
  /**
   * Liste toutes les transactions du workspace (filtres paramétrés)
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
    const conds: string[] = ['t.workspace_id::text = $1'];
    const params: any[] = [workspaceId];

    if (filters?.type) {
      params.push(filters.type);
      conds.push(`t.type = $${params.length}`);
    }
    if (filters?.category) {
      params.push(filters.category);
      conds.push(`t.category = $${params.length}`);
    }
    if (filters?.status) {
      params.push(filters.status);
      conds.push(`t.status = $${params.length}`);
    }
    if (filters?.walletId) {
      // Accepte l'UUID PK (wallets.id) ou le business code (wallets.wallet_id)
      params.push(filters.walletId);
      const n = params.length;
      conds.push(
        `(t.source_wallet_id IN (SELECT w.id FROM wallets w WHERE w.id::text = $${n} OR w.wallet_id = $${n})
          OR t.destination_wallet_id IN (SELECT w.id FROM wallets w WHERE w.id::text = $${n} OR w.wallet_id = $${n}))`
      );
    }
    if (filters?.startDate) {
      params.push(filters.startDate);
      conds.push(`t.processed_at >= $${params.length}::timestamp`);
    }
    if (filters?.endDate) {
      params.push(filters.endDate);
      conds.push(`t.processed_at < $${params.length}::date + INTERVAL '1 day'`);
    }

    const r = await postgresClient.query<any>(
      `SELECT ${txColumns('t.')},
              sw.name AS "SourceWalletName",
              dw.name AS "DestinationWalletName"
       FROM transactions t
       LEFT JOIN wallets sw ON sw.id = t.source_wallet_id
       LEFT JOIN wallets dw ON dw.id = t.destination_wallet_id
       WHERE ${conds.join(' AND ')}
       ORDER BY t.processed_at DESC`,
      params
    );
    return r.rows as Transaction[];
  }

  /**
   * Récupère une transaction par ID (business code `transaction_id` ou UUID PK).
   * `workspaceId` (si fourni) scope la recherche au tenant : empêche la
   * lecture cross-workspace par un utilisateur autorisé ailleurs.
   */
  async getById(transactionId: string, workspaceId?: string): Promise<Transaction | null> {
    const r = await postgresClient.query<any>(
      `SELECT ${txColumns('t.')},
              sw.name AS "SourceWalletName",
              dw.name AS "DestinationWalletName"
       FROM transactions t
       LEFT JOIN wallets sw ON sw.id = t.source_wallet_id
       LEFT JOIN wallets dw ON dw.id = t.destination_wallet_id
       WHERE (t.transaction_id = $1 OR t.id::text = $1)
         AND ($2::text IS NULL OR t.workspace_id::text = $2)
       LIMIT 1`,
      [transactionId, workspaceId ?? null]
    );
    return (r.rows[0] as Transaction) || null;
  }

  /**
   * Crée une transaction de revenus (income).
   * Atomique : l'insertion et le crédit du wallet réussissent ou échouent ensemble.
   */
  async createIncome(input: CreateTransactionInput): Promise<Transaction> {
    if (!input.destinationWalletId) {
      throw new ValidationError('Le wallet de destination est requis pour un revenu');
    }
    this.assertValidAmount(input.amount);

    return await postgresClient.transaction(async (client) => {
      const wallet = await this.lockWallet(client, input.destinationWalletId!, 'Wallet de destination non trouvé');
      const transaction = await this.insertTransaction(client, {
        ...input,
        type: 'income',
        destinationWalletId: wallet.id,
      });
      await this.applyBalanceDelta(client, wallet.id, input.amount);
      return transaction;
    });
  }

  /**
   * Crée une transaction de dépense (expense).
   * Atomique, avec verrou : la vérification du solde et le débit ne peuvent
   * plus être intercalés avec un autre débit concurrent.
   */
  async createExpense(input: CreateTransactionInput): Promise<Transaction> {
    if (!input.sourceWalletId) {
      throw new ValidationError('Le wallet source est requis pour une dépense');
    }
    this.assertValidAmount(input.amount);

    return await postgresClient.transaction(async (client) => {
      const wallet = await this.lockWallet(client, input.sourceWalletId!, 'Wallet source non trouvé');
      if (wallet.balance < input.amount) {
        throw new ConflictError('Solde insuffisant');
      }
      const transaction = await this.insertTransaction(client, {
        ...input,
        type: 'expense',
        sourceWalletId: wallet.id,
      });
      await this.applyBalanceDelta(client, wallet.id, -input.amount);
      return transaction;
    });
  }

  /**
   * Crée une transaction de transfert (atomique, deux wallets verrouillés
   * dans un ordre déterministe pour éviter les deadlocks croisés).
   */
  async createTransfer(input: CreateTransactionInput): Promise<Transaction> {
    if (!input.sourceWalletId || !input.destinationWalletId) {
      throw new ValidationError('Les wallets source et destination sont requis pour un transfert');
    }
    this.assertValidAmount(input.amount);

    return await postgresClient.transaction(async (client) => {
      const sourceUuid = await this.resolveWalletUuid(client, input.sourceWalletId!);
      const destUuid = await this.resolveWalletUuid(client, input.destinationWalletId!);
      if (!sourceUuid) throw new Error('Wallet source non trouvé');
      if (!destUuid) throw new Error('Wallet de destination non trouvé');
      if (sourceUuid === destUuid) {
        throw new ValidationError('Les wallets source et destination doivent être différents');
      }

      // Ordre de verrouillage déterministe (tri UUID) → pas de deadlock
      // si deux transferts croisés A→B et B→A arrivent en même temps.
      const locked = new Map<string, LockedWallet>();
      for (const uuid of [sourceUuid, destUuid].sort()) {
        locked.set(uuid, await this.lockWallet(client, uuid, 'Wallet non trouvé'));
      }
      const source = locked.get(sourceUuid)!;

      if (source.balance < input.amount) {
        throw new ConflictError('Solde insuffisant dans le wallet source');
      }

      const transaction = await this.insertTransaction(client, {
        ...input,
        type: 'transfer',
        category: 'transfer',
        sourceWalletId: sourceUuid,
        destinationWalletId: destUuid,
      });
      await this.applyBalanceDelta(client, sourceUuid, -input.amount);
      await this.applyBalanceDelta(client, destUuid, input.amount);
      return transaction;
    });
  }

  /**
   * Annule une transaction : inverse les mouvements de solde et passe le
   * statut à `cancelled`, le tout atomiquement. La ligne transaction est
   * verrouillée pour empêcher une double annulation concurrente.
   */
  async cancel(transactionId: string, workspaceId?: string): Promise<Transaction> {
    return await postgresClient.transaction(async (client) => {
      const r = await client.query(
        `SELECT id, type, status, amount::float AS amount,
                source_wallet_id, destination_wallet_id
         FROM transactions
         WHERE (transaction_id = $1 OR id::text = $1)
           AND ($2::text IS NULL OR workspace_id::text = $2)
         LIMIT 1
         FOR UPDATE`,
        [transactionId, workspaceId ?? null]
      );
      const tx = r.rows[0];
      if (!tx) {
        throw new NotFoundError('Transaction non trouvée');
      }
      if (tx.status === 'cancelled') {
        throw new ConflictError('Transaction déjà annulée');
      }

      // Inverse les mouvements selon le type — UNIQUEMENT si la transaction
      // a réellement impacté les soldes : une transaction restée 'pending'
      // (legacy) n'a jamais mouvementé les wallets, inverser créerait un
      // écart de caisse permanent.
      if (tx.status === 'completed') {
        if (tx.type === 'income' && tx.destination_wallet_id) {
          await this.lockWallet(client, tx.destination_wallet_id, 'Wallet de destination non trouvé');
          await this.applyBalanceDelta(client, tx.destination_wallet_id, -tx.amount);
        } else if (tx.type === 'expense' && tx.source_wallet_id) {
          await this.lockWallet(client, tx.source_wallet_id, 'Wallet source non trouvé');
          await this.applyBalanceDelta(client, tx.source_wallet_id, tx.amount);
        } else if (tx.type === 'transfer' && tx.source_wallet_id && tx.destination_wallet_id) {
          for (const uuid of [tx.source_wallet_id, tx.destination_wallet_id].sort()) {
            await this.lockWallet(client, uuid, 'Wallet non trouvé');
          }
          await this.applyBalanceDelta(client, tx.source_wallet_id, tx.amount);
          await this.applyBalanceDelta(client, tx.destination_wallet_id, -tx.amount);
        }
      }

      const updated = await client.query(
        `UPDATE transactions
         SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING ${TX_COLUMNS}`,
        [tx.id]
      );
      return updated.rows[0] as Transaction;
    });
  }

  /**
   * Met à jour une transaction (statut, description, référence)
   */
  async update(transactionId: string, updates: Partial<Transaction>): Promise<Transaction> {
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];
    const push = (col: string, v: any) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (updates.Status !== undefined) push('status', updates.Status);
    if (updates.Description !== undefined) push('description', updates.Description);
    if (updates.Reference !== undefined) push('reference', updates.Reference);

    params.push(transactionId);
    const r = await postgresClient.query<any>(
      `UPDATE transactions
       SET ${sets.join(', ')}
       WHERE transaction_id = $${params.length} OR id::text = $${params.length}
       RETURNING ${TX_COLUMNS}`,
      params
    );
    if (r.rows.length === 0) {
      throw new NotFoundError('Transaction non trouvée');
    }
    return r.rows[0] as Transaction;
  }

  /**
   * Récupère les statistiques
   */
  async getStatistics(workspaceId: string, period?: { startDate: string; endDate: string }): Promise<TreasuryStatistics> {
    const transactions = await this.list(workspaceId, {
      status: 'completed',
      ...(period ? { startDate: period.startDate, endDate: period.endDate } : {}),
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

  // ---------------------------------------------------------------------
  // Privé
  // ---------------------------------------------------------------------

  private assertValidAmount(amount: number): void {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      throw new ValidationError('Montant invalide : doit être un nombre strictement positif');
    }
  }

  /** Résout un wallet (UUID PK ou business code wallet_id) en UUID PK. */
  private async resolveWalletUuid(client: Queryable, idOrSlug: string): Promise<string | null> {
    const r = await client.query(
      `SELECT id FROM wallets WHERE id::text = $1 OR wallet_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    return r.rows[0]?.id ?? null;
  }

  /**
   * Verrouille la ligne wallet (FOR UPDATE) et retourne son état courant.
   * Le verrou tient jusqu'au COMMIT/ROLLBACK de la transaction englobante.
   */
  private async lockWallet(client: Queryable, idOrSlug: string, notFoundMessage: string): Promise<LockedWallet> {
    const r = await client.query(
      `SELECT id, name, balance::float AS balance
       FROM wallets
       WHERE id::text = $1 OR wallet_id = $1
       LIMIT 1
       FOR UPDATE`,
      [idOrSlug]
    );
    if (r.rows.length === 0) {
      throw new Error(notFoundMessage);
    }
    return r.rows[0] as LockedWallet;
  }

  /** Applique un delta au solde (le wallet doit déjà être verrouillé). */
  private async applyBalanceDelta(client: Queryable, walletUuid: string, delta: number): Promise<void> {
    const r = await client.query(
      `UPDATE wallets
       SET balance = balance + $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING balance::float AS balance`,
      [walletUuid, delta]
    );
    if (r.rows.length === 0) {
      throw new Error('Wallet non trouvé');
    }
    if (Number(r.rows[0].balance) < 0) {
      // Le ROLLBACK de la transaction englobante annule ce UPDATE.
      // ConflictError → 409 : cas metier (ex. annuler un income dont les
      // fonds ont deja ete depenses), pas une erreur serveur.
      throw new ConflictError('Solde insuffisant');
    }
  }

  /**
   * Insère la transaction dans la transaction SQL en cours.
   *
   * processedById peut être soit l'UUID PK (users.id), soit le business code
   * (users.user_id = "USR-…"). Convention de l'app : la session véhicule le
   * business code via getCurrentUserId(). On résout ici pour éviter
   * "invalid input syntax for type uuid" sur transactions.processed_by_id.
   */
  private async insertTransaction(client: Queryable, input: CreateTransactionInput): Promise<Transaction> {
    const transactionNumber = await this.generateTransactionNumber(client, input.workspaceId, input.type);
    const processedByUuid = await this.resolveUserUuid(client, input.processedById);

    // expense_id n'est référencé que s'il est fourni : la colonne vient
    // d'une migration optionnelle (migration-transactions-expense-link.sql).
    const cols = [
      'transaction_id', 'transaction_number', 'type', 'category', 'amount',
      'source_wallet_id', 'destination_wallet_id', 'description', 'reference',
      'attachment_url', 'status', 'processed_by_id', 'processed_at', 'workspace_id',
      'created_at', 'updated_at',
    ];
    const values = [
      '$1', '$2', '$3', '$4', '$5',
      '$6::uuid', '$7::uuid', '$8', '$9::varchar',
      '$10::text', `'completed'`, '$11::uuid', 'CURRENT_TIMESTAMP', '$12::uuid',
      'CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP',
    ];
    const params: any[] = [
      uuidv4(), transactionNumber, input.type, input.category, input.amount,
      input.sourceWalletId ?? null, input.destinationWalletId ?? null,
      input.description, input.reference ?? null,
      input.attachmentUrl ?? null, processedByUuid, input.workspaceId,
    ];
    if (input.expenseId) {
      params.push(input.expenseId);
      cols.push('expense_id');
      values.push(`$${params.length}::uuid`);
    }

    const r = await client.query(
      `INSERT INTO transactions (${cols.join(', ')})
       VALUES (${values.join(', ')})
       RETURNING ${TX_COLUMNS}`,
      params
    );
    return r.rows[0] as Transaction;
  }

  /** Accepte UUID PK ou business code user_id et retourne l'UUID PK. */
  private async resolveUserUuid(client: Queryable, idOrSlug: string): Promise<string> {
    const r = await client.query(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    if (r.rows.length === 0) throw new Error('Utilisateur introuvable');
    return r.rows[0].id;
  }

  /**
   * Génère un numéro de transaction unique — séquence atomique par
   * (workspace, type), amorcée depuis le COUNT existant pour assurer la
   * continuité de la numérotation historique.
   */
  private async generateTransactionNumber(client: Queryable, workspaceId: string, type: TransactionType): Promise<string> {
    const typePrefix: Record<TransactionType, string> = {
      income: 'INC',
      expense: 'EXP',
      transfer: 'TRF',
    };

    const prefix = typePrefix[type];
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const sequence = await nextDocSequence(
      `transactions:${workspaceId}:${type}`,
      async () => {
        // Seed anti-collision : les numéros legacy étaient générés depuis un
        // COUNT de TOUTE la table (le filtre du parser legacy était abandonné)
        // — valeur bien plus haute que le COUNT par type. On repart donc du
        // plus grand suffixe déjà émis pour ce préfixe, jamais d'un count.
        const r = await client.query(
          `SELECT COALESCE(MAX(substring(transaction_number from '-(\\d+)$')::int), 0) AS n
           FROM transactions
           WHERE workspace_id::text = $1
             AND transaction_number LIKE $2 || '-%'
             AND transaction_number ~ '-\\d+$'`,
          [workspaceId, prefix]
        );
        return Number(r.rows[0]?.n ?? 0);
      },
      client
    );

    return `${prefix}-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }
}
