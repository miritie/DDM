/**
 * Service - Gestion des Dépenses
 * Module Dépenses
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Expense, ExpenseAttachment, ExpenseStatus } from '@/types/modules';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { JournalGenerationService } from '@/lib/modules/accounting/journal-generation-service';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();
const paymentMethodService = new PaymentMethodService();
const transactionService = new TransactionService();
const journalGenerator = new JournalGenerationService();

export interface PayFromWalletsInput {
  expenseId: string;          // UUID PK ou business code
  payerId: string;            // UUID PK ou business code de l'utilisateur qui exécute
  paymentDate?: string;       // ISO. Défaut: now()
  allocations: Array<{
    walletId: string;         // UUID PK du wallet
    amount: number;
  }>;
  notes?: string;
}

export interface CreateExpenseInput {
  expenseRequestId: string;
  title: string;
  description?: string;
  amount: number;
  categoryId: string;
  payerId: string;
  beneficiaryId?: string;
  workspaceId: string;
}

export interface PayExpenseInput {
  expenseId: string;
  paymentDate: string;
  paymentMethod: string;
  payerId: string;
}

export interface AddAttachmentInput {
  expenseId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
}

export class ExpenseService {
  async generateExpenseNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const expenses = await postgresClient.list<Expense>('expenses', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', YEAR({created_at}) = ${year})`,
    });
    return `DEP-${year}-${String(expenses.length + 1).padStart(4, '0')}`;
  }

  async create(input: CreateExpenseInput): Promise<Expense> {
    const expenseNumber = await this.generateExpenseNumber(input.workspaceId);

    const expense: Partial<Expense> = {
      ExpenseId: uuidv4(),
      ExpenseNumber: expenseNumber,
      ExpenseRequestId: input.expenseRequestId,
      Title: input.title,
      Description: input.description,
      Amount: input.amount,
      CategoryId: input.categoryId,
      PayerId: input.payerId,
      BeneficiaryId: input.beneficiaryId,
      Status: 'pending' as ExpenseStatus,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Expense>('expenses', expense);
    return created;
  }

  async getById(expenseId: string): Promise<Expense | null> {
    const expenses = await postgresClient.list<Expense>('expenses', {
      filterByFormula: `{expense_id} = '${expenseId}'`,
    });
    return expenses.length > 0 ? expenses[0] : null;
  }

  async list(
    workspaceId: string,
    filters: {
      status?: string;
      categoryId?: string;
      payerId?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<Expense[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.status) {
      filterFormulas.push(`{status} = '${filters.status}'`);
    }
    if (filters.categoryId) {
      filterFormulas.push(`{category_id} = '${filters.categoryId}'`);
    }
    if (filters.payerId) {
      filterFormulas.push(`{payer_id} = '${filters.payerId}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{created_at} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{created_at} <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<Expense>('expenses', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  async approve(expenseId: string): Promise<Expense> {
    const expenses = await postgresClient.list<Expense>('expenses', {
      filterByFormula: `{expense_id} = '${expenseId}'`,
    });

    if (expenses.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    if (expenses[0].Status !== 'pending') {
      throw new Error('Seules les dépenses en attente peuvent être approuvées');
    }

    const recordId = (expenses[0] as any).Id ?? (expenses[0] as any).id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    const updated = await postgresClient.update<Expense>(
      'expenses',
      recordId,
      {
        Status: 'approved',
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async pay(input: PayExpenseInput): Promise<Expense> {
    const expenses = await postgresClient.list<Expense>('expenses', {
      filterByFormula: `{expense_id} = '${input.expenseId}'`,
    });

    if (expenses.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    if (expenses[0].Status !== 'approved') {
      throw new Error('Seules les dépenses approuvées peuvent être payées');
    }

    const recordId = (expenses[0] as any).Id ?? (expenses[0] as any).id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    // Résolution payment_method_id (la colonne enum legacy a été supprimée en 2c).
    const workspaceId = (expenses[0] as any).WorkspaceId || (expenses[0] as any).workspace_id;
    if (!workspaceId) throw new Error('Workspace introuvable pour cette dépense');
    const pm = await paymentMethodService.getByCode(workspaceId, input.paymentMethod);
    if (!pm?.Id) {
      throw new Error(`Moyen de paiement "${input.paymentMethod}" introuvable ou inactif dans ce workspace.`);
    }

    const updateData: any = {
      Status: 'paid',
      PaymentDate: input.paymentDate,
      PaymentMethodId: pm.Id,
      PayerId: input.payerId,
      UpdatedAt: new Date().toISOString(),
    };
    const updated = await postgresClient.update<Expense>('expenses', recordId, updateData);
    return updated;
  }

  /**
   * Paiement multi-wallet d'une dépense approuvée.
   *
   * - Vérifie que la dépense est en statut 'approved'
   * - Vérifie que Σ allocations === expense.amount (tolérance 1 centime)
   * - Vérifie que chaque wallet a un solde suffisant
   * - Crée N transactions (type='expense'), une par wallet, liées à l'expense via expense_id
   * - Décrémente les soldes des wallets
   * - Passe la dépense en 'paid'
   *
   * NB : pas de transaction SQL globale ici — chaque createExpense est atomique
   * mais le batch ne l'est pas. En cas d'erreur au milieu, les transactions déjà
   * créées restent valides et la dépense reste en 'approved'. L'utilisateur peut
   * compléter manuellement ou réessayer (le service vérifiera le statut).
   */
  async payFromWallets(input: PayFromWalletsInput): Promise<{
    expense: any;
    transactions: any[];
    journalEntryId?: string | null;
    journalError?: string | null;
  }> {
    if (!input.allocations || input.allocations.length === 0) {
      throw new Error('Au moins une allocation wallet est requise');
    }
    if (input.allocations.some(a => a.amount <= 0)) {
      throw new Error('Chaque allocation doit avoir un montant positif');
    }

    const expR = await postgresClient.query<any>(
      `SELECT id, expense_id, amount, status, workspace_id, title
       FROM expenses
       WHERE id::text = $1 OR expense_id = $1
       LIMIT 1`,
      [input.expenseId]
    );
    if (expR.rows.length === 0) throw new Error('Dépense introuvable');
    const expense = expR.rows[0];

    if (expense.status !== 'approved' && expense.status !== 'scheduled') {
      throw new Error(`Seules les dépenses approuvées ou planifiées peuvent être payées (statut actuel : ${expense.status})`);
    }

    const total = input.allocations.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(total - Number(expense.amount)) > 0.01) {
      throw new Error(`Le total des allocations (${total}) ne correspond pas au montant de la dépense (${expense.amount})`);
    }

    const userR = await postgresClient.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [input.payerId]
    );
    if (userR.rows.length === 0) throw new Error('Utilisateur payeur introuvable');
    const payerUuid = userR.rows[0].id;

    // Récupération en 1 seule requête de tous les wallets concernés (au lieu
    // d'un SELECT par allocation — N+1 mortel en 3G).
    const walletIds = input.allocations.map(a => a.walletId);
    const walletsR = await postgresClient.query<any>(
      `SELECT id, balance, name FROM wallets WHERE id::text = ANY($1)`,
      [walletIds]
    );
    const walletById = new Map<string, any>(walletsR.rows.map((w: any) => [w.id, w]));
    for (const alloc of input.allocations) {
      const w = walletById.get(alloc.walletId);
      if (!w) {
        throw new Error(`Wallet introuvable : ${alloc.walletId}`);
      }
      if (Number(w.balance) < alloc.amount) {
        throw new Error(`Solde insuffisant sur le wallet "${w.name}" (solde : ${w.balance}, requis : ${alloc.amount})`);
      }
    }

    const transactions: any[] = [];
    for (const alloc of input.allocations) {
      const tx = await transactionService.createExpense({
        type: 'expense',
        category: 'expense',
        amount: alloc.amount,
        sourceWalletId: alloc.walletId,
        description: `Paiement dépense ${expense.expense_id} — ${expense.title}${input.notes ? ` (${input.notes})` : ''}`,
        reference: expense.expense_id,
        processedById: payerUuid,
        workspaceId: expense.workspace_id,
        expenseId: expense.id,
      });
      transactions.push(tx);
    }

    const paidR = await postgresClient.query<any>(
      `UPDATE expenses
       SET status='paid',
           payer_id=$2,
           payment_date=$3,
           updated_at=CURRENT_TIMESTAMP
       WHERE id=$1
       RETURNING *`,
      [expense.id, payerUuid, input.paymentDate || new Date().toISOString()]
    );

    // Génération automatique de l'écriture comptable OHADA (best-effort).
    // En cas d'erreur (catégorie mal configurée, wallet sans compte mappé…),
    // le paiement reste valide mais on remonte un warning dans le retour.
    let journalEntryId: string | null = null;
    let journalError: string | null = null;
    try {
      journalEntryId = await journalGenerator.fromExpensePayment(expense.id);
    } catch (e: any) {
      journalError = e?.message || 'Génération comptable échouée';
      console.error(`[payFromWallets] Écriture comptable non générée pour ${expense.expense_id}:`, journalError);
    }

    return { expense: paidR.rows[0], transactions, journalEntryId, journalError };
  }

  /**
   * Planifie le paiement d'une dépense approuvée à une date future.
   * approved → scheduled. La dépense reste payable directement sans passer
   * par scheduled (le statut intermédiaire est optionnel).
   *
   * scheduled → paid se fait via payFromWallets — qui accepte aussi bien
   * 'approved' que 'scheduled' (cf. logique mise à jour ci-dessous).
   */
  async schedule(input: {
    expenseId: string;
    scheduledDate: string; // ISO date YYYY-MM-DD
    payerId: string;
  }): Promise<any> {
    const expR = await postgresClient.query<any>(
      `SELECT id, expense_id, status FROM expenses
       WHERE id::text = $1 OR expense_id = $1 LIMIT 1`,
      [input.expenseId]
    );
    if (expR.rows.length === 0) throw new Error('Dépense introuvable');
    const exp = expR.rows[0];
    if (exp.status !== 'approved') {
      throw new Error(`Seules les dépenses approuvées peuvent être planifiées (statut actuel : ${exp.status})`);
    }

    const userR = await postgresClient.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [input.payerId]
    );
    if (userR.rows.length === 0) throw new Error('Utilisateur introuvable');

    const r = await postgresClient.query<any>(
      `UPDATE expenses
       SET status = 'scheduled',
           scheduled_payment_date = $2,
           payer_id = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [exp.id, input.scheduledDate, userR.rows[0].id]
    );
    return r.rows[0];
  }

  /**
   * Liste les transactions liées à une dépense (pour affichage du paiement dans l'UI).
   */
  async listPaymentTransactions(expenseId: string): Promise<any[]> {
    const r = await postgresClient.query<any>(
      `SELECT t.id, t.transaction_id, t.transaction_number, t.amount,
              t.source_wallet_id, w.name AS wallet_name,
              t.processed_at, t.description, t.status,
              u.full_name AS processed_by_name
       FROM transactions t
       JOIN expenses e ON e.id = t.expense_id
       LEFT JOIN wallets w ON w.id = t.source_wallet_id
       LEFT JOIN users u ON u.id = t.processed_by_id
       WHERE e.id::text = $1 OR e.expense_id = $1
       ORDER BY t.processed_at ASC`,
      [expenseId]
    );
    return r.rows;
  }

  async reject(expenseId: string): Promise<Expense> {
    const expenses = await postgresClient.list<Expense>('expenses', {
      filterByFormula: `{expense_id} = '${expenseId}'`,
    });

    if (expenses.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    if (expenses[0].Status !== 'pending') {
      throw new Error('Seules les dépenses en attente peuvent être rejetées');
    }

    const recordId = (expenses[0] as any).Id ?? (expenses[0] as any).id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    const updated = await postgresClient.update<Expense>(
      'expenses',
      recordId,
      {
        Status: 'rejected',
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async cancel(expenseId: string): Promise<Expense> {
    const expenses = await postgresClient.list<Expense>('expenses', {
      filterByFormula: `{expense_id} = '${expenseId}'`,
    });

    if (expenses.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    if (expenses[0].Status === 'paid') {
      throw new Error('Une dépense payée ne peut pas être annulée');
    }

    const recordId = (expenses[0] as any).Id ?? (expenses[0] as any).id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    const updated = await postgresClient.update<Expense>(
      'expenses',
      recordId,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async addAttachment(input: AddAttachmentInput): Promise<ExpenseAttachment> {
    const attachment = {
      AttachmentId: uuidv4(),
      ExpenseId: input.expenseId,
      FileName: input.fileName,
      FileUrl: input.fileUrl,
      FileSize: input.fileSize,
      MimeType: input.mimeType,
      UploadedById: input.uploadedById,
      UploadedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<ExpenseAttachment>('expense_attachments', attachment);
    return created;
  }

  async getAttachments(expenseId: string): Promise<ExpenseAttachment[]> {
    return await postgresClient.list<ExpenseAttachment>('expense_attachments', {
      filterByFormula: `{expense_id} = '${expenseId}'`,
      sort: [{ field: 'UploadedAt', direction: 'desc' }],
    });
  }

  async getStatistics(workspaceId: string, period?: { startDate: string; endDate: string }): Promise<any> {
    const filters: any = {};
    if (period) {
      filters.startDate = period.startDate;
      filters.endDate = period.endDate;
    }

    const expenses = await this.list(workspaceId, filters);

    const totalExpenses = expenses.length;
    const pendingExpenses = expenses.filter((e) => e.Status === 'pending').length;
    const approvedExpenses = expenses.filter((e) => e.Status === 'approved').length;
    const paidExpenses = expenses.filter((e) => e.Status === 'paid').length;
    const rejectedExpenses = expenses.filter((e) => e.Status === 'rejected').length;

    const totalAmount = expenses.reduce((sum, e) => sum + e.Amount, 0);
    const paidAmount = expenses
      .filter((e) => e.Status === 'paid')
      .reduce((sum, e) => sum + e.Amount, 0);
    const pendingAmount = expenses
      .filter((e) => ['pending', 'approved'].includes(e.Status))
      .reduce((sum, e) => sum + e.Amount, 0);

    // Dépenses par catégorie
    const byCategory: Record<string, { count: number; amount: number }> = {};
    expenses.forEach((expense) => {
      if (!byCategory[expense.CategoryId]) {
        byCategory[expense.CategoryId] = { count: 0, amount: 0 };
      }
      byCategory[expense.CategoryId].count++;
      byCategory[expense.CategoryId].amount += expense.Amount;
    });

    return {
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      paidExpenses,
      rejectedExpenses,
      totalAmount,
      paidAmount,
      pendingAmount,
      averageAmount: totalExpenses > 0 ? totalAmount / totalExpenses : 0,
      byCategory,
    };
  }
}
