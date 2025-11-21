/**
 * Service - Gestion des Dépenses
 * Module Dépenses
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Expense, ExpenseAttachment, ExpenseStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

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

    const recordId = expenses[0].id;
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

    const recordId = expenses[0].id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    const updated = await postgresClient.update<Expense>(
      'expenses',
      recordId,
      {
        Status: 'paid',
        PaymentDate: input.paymentDate,
        PaymentMethod: input.paymentMethod,
        PayerId: input.payerId,
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
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

    const recordId = expenses[0].id;
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

    const recordId = expenses[0].id;
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
