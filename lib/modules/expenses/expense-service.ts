/**
 * Service - Gestion des Dépenses
 * Module Dépenses
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Expense, ExpenseAttachment } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
    const expenses = await airtableClient.list<Expense>('Expense', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({CreatedAt}) = ${year})`,
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
      Status: 'pending',
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<Expense>('Expense', expense);
  }

  async getById(expenseId: string): Promise<Expense | null> {
    const expenses = await airtableClient.list<Expense>('Expense', {
      filterByFormula: `{ExpenseId} = '${expenseId}'`,
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
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.categoryId) {
      filterFormulas.push(`{CategoryId} = '${filters.categoryId}'`);
    }
    if (filters.payerId) {
      filterFormulas.push(`{PayerId} = '${filters.payerId}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{CreatedAt} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{CreatedAt} <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await airtableClient.list<Expense>('Expense', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  async approve(expenseId: string): Promise<Expense> {
    const expenses = await airtableClient.list<Expense>('Expense', {
      filterByFormula: `{ExpenseId} = '${expenseId}'`,
    });

    if (expenses.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    if (expenses[0].Status !== 'pending') {
      throw new Error('Seules les dépenses en attente peuvent être approuvées');
    }

    return await airtableClient.update<Expense>(
      'Expense',
      (expenses[0] as any)._recordId,
      {
        Status: 'approved',
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async pay(input: PayExpenseInput): Promise<Expense> {
    const expenses = await airtableClient.list<Expense>('Expense', {
      filterByFormula: `{ExpenseId} = '${input.expenseId}'`,
    });

    if (expenses.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    if (expenses[0].Status !== 'approved') {
      throw new Error('Seules les dépenses approuvées peuvent être payées');
    }

    return await airtableClient.update<Expense>(
      'Expense',
      (expenses[0] as any)._recordId,
      {
        Status: 'paid',
        PaymentDate: input.paymentDate,
        PaymentMethod: input.paymentMethod,
        PayerId: input.payerId,
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async reject(expenseId: string): Promise<Expense> {
    const expenses = await airtableClient.list<Expense>('Expense', {
      filterByFormula: `{ExpenseId} = '${expenseId}'`,
    });

    if (expenses.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    if (expenses[0].Status !== 'pending') {
      throw new Error('Seules les dépenses en attente peuvent être rejetées');
    }

    return await airtableClient.update<Expense>(
      'Expense',
      (expenses[0] as any)._recordId,
      {
        Status: 'rejected',
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async cancel(expenseId: string): Promise<Expense> {
    const expenses = await airtableClient.list<Expense>('Expense', {
      filterByFormula: `{ExpenseId} = '${expenseId}'`,
    });

    if (expenses.length === 0) {
      throw new Error('Dépense non trouvée');
    }

    if (expenses[0].Status === 'paid') {
      throw new Error('Une dépense payée ne peut pas être annulée');
    }

    return await airtableClient.update<Expense>(
      'Expense',
      (expenses[0] as any)._recordId,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async addAttachment(input: AddAttachmentInput): Promise<ExpenseAttachment> {
    const attachment: Partial<ExpenseAttachment> = {
      AttachmentId: uuidv4(),
      ExpenseId: input.expenseId,
      FileName: input.fileName,
      FileUrl: input.fileUrl,
      FileSize: input.fileSize,
      MimeType: input.mimeType,
      UploadedById: input.uploadedById,
      UploadedAt: new Date().toISOString(),
    };

    return await airtableClient.create<ExpenseAttachment>('ExpenseAttachment', attachment);
  }

  async getAttachments(expenseId: string): Promise<ExpenseAttachment[]> {
    return await airtableClient.list<ExpenseAttachment>('ExpenseAttachment', {
      filterByFormula: `{ExpenseId} = '${expenseId}'`,
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
