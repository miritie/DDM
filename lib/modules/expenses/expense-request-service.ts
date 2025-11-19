/**
 * Service - Gestion des Demandes de Dépenses
 * Module Dépenses
 */

import { AirtableClient } from '@/lib/airtable/client';
import { ExpenseRequest, ExpenseApprovalStep } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateExpenseRequestInput {
  title: string;
  description?: string;
  amount: number;
  categoryId: string;
  requesterId: string;
  workspaceId: string;
}

export interface ApproveRejectInput {
  requestId: string;
  approverId: string;
  status: 'approved' | 'rejected';
  comments?: string;
}

export class ExpenseRequestService {
  async generateRequestNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const requests = await airtableClient.list<ExpenseRequest>('ExpenseRequest', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({CreatedAt}) = ${year})`,
    });
    return `EXP-${year}-${String(requests.length + 1).padStart(4, '0')}`;
  }

  async create(input: CreateExpenseRequestInput): Promise<ExpenseRequest> {
    const requestNumber = await this.generateRequestNumber(input.workspaceId);

    const request: any = {
      ExpenseRequestId: uuidv4(),
      RequestNumber: requestNumber,
      Title: input.title,
      Description: input.description,
      Amount: input.amount,
      CategoryId: input.categoryId,
      RequesterId: input.requesterId,
      Status: 'draft',
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<ExpenseRequest>('ExpenseRequest', request);
    if (!created) {
      throw new Error('Failed to create expense request - Airtable not configured');
    }
    return created;
  }

  async getById(requestId: string): Promise<ExpenseRequest | null> {
    const requests = await airtableClient.list<ExpenseRequest>('ExpenseRequest', {
      filterByFormula: `{ExpenseRequestId} = '${requestId}'`,
    });
    return requests.length > 0 ? requests[0] : null;
  }

  async list(
    workspaceId: string,
    filters: { status?: string; requesterId?: string; categoryId?: string } = {}
  ): Promise<ExpenseRequest[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.requesterId) {
      filterFormulas.push(`{RequesterId} = '${filters.requesterId}'`);
    }
    if (filters.categoryId) {
      filterFormulas.push(`{CategoryId} = '${filters.categoryId}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await airtableClient.list<ExpenseRequest>('ExpenseRequest', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  async submit(requestId: string): Promise<ExpenseRequest> {
    const requests = await airtableClient.list<ExpenseRequest>('ExpenseRequest', {
      filterByFormula: `{ExpenseRequestId} = '${requestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande non trouvée');
    }

    if (requests[0].Status !== 'draft') {
      throw new Error('Seules les demandes en brouillon peuvent être soumises');
    }

    const updated = await airtableClient.update<ExpenseRequest>(
      'ExpenseRequest',
      (requests[0] as any)._recordId,
      {
        Status: 'submitted',
        UpdatedAt: new Date().toISOString(),
      } as any
    );
    if (!updated) {
      throw new Error('Failed to update expense request - Airtable not configured');
    }
    return updated;
  }

  async approve(input: ApproveRejectInput): Promise<ExpenseRequest> {
    const requests = await airtableClient.list<ExpenseRequest>('ExpenseRequest', {
      filterByFormula: `{ExpenseRequestId} = '${input.requestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande non trouvée');
    }

    if (requests[0].Status !== 'submitted') {
      throw new Error('Seules les demandes soumises peuvent être approuvées');
    }

    // Create approval step record
    const approvalStep: Partial<ExpenseApprovalStep> = {
      ApprovalStepId: uuidv4(),
      ExpenseRequestId: input.requestId,
      ApproverId: input.approverId,
      StepOrder: 1,
      Status: input.status,
      Comments: input.comments,
      ProcessedAt: new Date().toISOString(),
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdStep = await airtableClient.create<ExpenseApprovalStep>('ExpenseApprovalStep', approvalStep);
    if (!createdStep) {
      throw new Error('Failed to create expense approval step - Airtable not configured');
    }

    const updated = await airtableClient.update<ExpenseRequest>(
      'ExpenseRequest',
      (requests[0] as any)._recordId,
      {
        Status: input.status,
        UpdatedAt: new Date().toISOString(),
      }
    );
    if (!updated) {
      throw new Error('Failed to update expense request - Airtable not configured');
    }
    return updated;
  }

  async cancel(requestId: string): Promise<ExpenseRequest> {
    const requests = await airtableClient.list<ExpenseRequest>('ExpenseRequest', {
      filterByFormula: `{ExpenseRequestId} = '${requestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande non trouvée');
    }

    if (['approved', 'rejected'].includes(requests[0].Status)) {
      throw new Error('Impossible d\'annuler une demande déjà traitée');
    }

    const updated = await airtableClient.update<ExpenseRequest>(
      'ExpenseRequest',
      (requests[0] as any)._recordId,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
    if (!updated) {
      throw new Error('Failed to update expense request - Airtable not configured');
    }
    return updated;
  }

  async update(
    requestId: string,
    updates: {
      title?: string;
      description?: string;
      amount?: number;
      categoryId?: string;
    }
  ): Promise<ExpenseRequest> {
    const requests = await airtableClient.list<ExpenseRequest>('ExpenseRequest', {
      filterByFormula: `{ExpenseRequestId} = '${requestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande non trouvée');
    }

    if (requests[0].Status !== 'draft') {
      throw new Error('Seules les demandes en brouillon peuvent être modifiées');
    }

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateData.Title = updates.title;
    if (updates.description !== undefined) updateData.Description = updates.description;
    if (updates.amount !== undefined) updateData.Amount = updates.amount;
    if (updates.categoryId !== undefined) updateData.CategoryId = updates.categoryId;

    const updated = await airtableClient.update<ExpenseRequest>(
      'ExpenseRequest',
      (requests[0] as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update expense request - Airtable not configured');
    }
    return updated;
  }

  async getStatistics(workspaceId: string): Promise<any> {
    const requests = await this.list(workspaceId);

    const totalRequests = requests.length;
    const draftRequests = requests.filter((r) => r.Status === 'draft').length;
    const submittedRequests = requests.filter((r) => r.Status === 'submitted').length;
    const approvedRequests = requests.filter((r) => r.Status === 'approved').length;
    const rejectedRequests = requests.filter((r) => r.Status === 'rejected').length;

    const totalAmount = requests.reduce((sum, r) => sum + r.Amount, 0);
    const approvedAmount = requests
      .filter((r) => r.Status === 'approved')
      .reduce((sum, r) => sum + r.Amount, 0);

    return {
      totalRequests,
      draftRequests,
      submittedRequests,
      approvedRequests,
      rejectedRequests,
      totalAmount,
      approvedAmount,
      averageAmount: totalRequests > 0 ? totalAmount / totalRequests : 0,
    };
  }
}
