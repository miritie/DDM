/**
 * Service - Gestion des Demandes de Dépenses
 * Module Dépenses
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { ExpenseRequest, ExpenseApprovalStep, ExpenseRequestStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateExpenseRequestInput {
  title: string;
  description?: string;
  amount: number;
  categoryId: string;
  expenseTypeId?: string;          // optionnel : poste précis sous la catégorie
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
    const requests = await postgresClient.list<ExpenseRequest>('expense_requests', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', YEAR({created_at}) = ${year})`,
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
      Status: 'draft' as ExpenseRequestStatus,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      ...(input.expenseTypeId ? { ExpenseTypeId: input.expenseTypeId } : {}),
    };

    const created = await postgresClient.create<ExpenseRequest>('expense_requests', request);
    return created;
  }

  async getById(requestId: string): Promise<any | null> {
    const requests = await postgresClient.list<ExpenseRequest>('expense_requests', {
      filterByFormula: `{expense_request_id} = '${requestId}'`,
    });
    if (requests.length === 0) return null;
    const req = requests[0] as any;

    // Enrichir avec les infos de la catégorie (label + code) — la page de
    // détail en a besoin pour l'affichage et il n'y a pas (encore) de
    // sous-catégorie distincte dans le nouveau modèle.
    if (req.CategoryId) {
      const catR = await postgresClient.query<any>(
        `SELECT label, code FROM expense_categories WHERE id = $1 LIMIT 1`,
        [req.CategoryId]
      );
      if (catR.rows[0]) {
        req.CategoryLabel = catR.rows[0].label;
        req.CategoryCode = catR.rows[0].code;
      }
    }
    return req;
  }

  async list(
    workspaceId: string,
    filters: { status?: string; requesterId?: string; categoryId?: string } = {}
  ): Promise<ExpenseRequest[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.status) {
      filterFormulas.push(`{status} = '${filters.status}'`);
    }
    if (filters.requesterId) {
      filterFormulas.push(`{requester_id} = '${filters.requesterId}'`);
    }
    if (filters.categoryId) {
      filterFormulas.push(`{category_id} = '${filters.categoryId}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<ExpenseRequest>('expense_requests', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  async submit(requestId: string): Promise<ExpenseRequest> {
    const requests = await postgresClient.list<ExpenseRequest>('expense_requests', {
      filterByFormula: `{expense_request_id} = '${requestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande non trouvée');
    }

    if (requests[0].Status !== 'draft') {
      throw new Error('Seules les demandes en brouillon peuvent être soumises');
    }

    const recordId = requests[0].id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    const updated = await postgresClient.update<ExpenseRequest>(
      'expense_requests',
      recordId,
      {
        Status: 'submitted',
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async approve(input: ApproveRejectInput): Promise<ExpenseRequest> {
    const requests = await postgresClient.list<ExpenseRequest>('expense_requests', {
      filterByFormula: `{expense_request_id} = '${input.requestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande non trouvée');
    }

    if (requests[0].Status !== 'submitted') {
      throw new Error('Seules les demandes soumises peuvent être approuvées');
    }

    const req = requests[0] as any;
    const recordId = req.id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    // Create approval step record
    const approvalStep = {
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

    await postgresClient.create<ExpenseApprovalStep>('expense_approval_steps', approvalStep);

    const updated = await postgresClient.update<ExpenseRequest>(
      'expense_requests',
      recordId,
      {
        Status: input.status,
        UpdatedAt: new Date().toISOString(),
      }
    );

    // Si la demande est approuvée et qu'aucune expense n'existe encore (cas où
    // l'approbation passe via le workflow purchase_request, qui crée la sienne),
    // on crée automatiquement la dépense correspondante en statut 'approved'.
    // Le comptable pourra alors la planifier/payer via le panel.
    if (input.status === 'approved') {
      const existing = await postgresClient.query<any>(
        `SELECT id FROM expenses WHERE expense_request_id = $1 LIMIT 1`,
        [recordId]
      );
      if (existing.rows.length === 0) {
        const year = new Date().getFullYear();
        const cnt = await postgresClient.query<any>(
          `SELECT COUNT(*)::int AS n FROM expenses
           WHERE workspace_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
          [req.WorkspaceId, year]
        );
        const expenseNumber = `DEP-${year}-${String((cnt.rows[0]?.n || 0) + 1).padStart(4, '0')}`;

        await postgresClient.query<any>(
          `INSERT INTO expenses (
             expense_id, expense_number, expense_request_id, title, description,
             amount, category_id, expense_type_id, payer_id, status, workspace_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', $10)`,
          [
            `EXP-${uuidv4().slice(0, 8)}`,
            expenseNumber,
            recordId,
            req.Title,
            req.Description ?? null,
            req.Amount,
            req.CategoryId,
            req.ExpenseTypeId ?? null,
            input.approverId,  // payeur provisoire = approbateur, le comptable peut le changer au paiement
            req.WorkspaceId,
          ]
        );
      }
    }

    return updated;
  }

  async cancel(requestId: string): Promise<ExpenseRequest> {
    const requests = await postgresClient.list<ExpenseRequest>('expense_requests', {
      filterByFormula: `{expense_request_id} = '${requestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande non trouvée');
    }

    if (['approved', 'rejected'].includes(requests[0].Status)) {
      throw new Error('Impossible d\'annuler une demande déjà traitée');
    }

    const recordId = requests[0].id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    const updated = await postgresClient.update<ExpenseRequest>(
      'expense_requests',
      recordId,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
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
    const requests = await postgresClient.list<ExpenseRequest>('expense_requests', {
      filterByFormula: `{expense_request_id} = '${requestId}'`,
    });

    if (requests.length === 0) {
      throw new Error('Demande non trouvée');
    }

    if (requests[0].Status !== 'draft') {
      throw new Error('Seules les demandes en brouillon peuvent être modifiées');
    }

    const recordId = requests[0].id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.title !== undefined) updateData.Title = updates.title;
    if (updates.description !== undefined) updateData.Description = updates.description;
    if (updates.amount !== undefined) updateData.Amount = updates.amount;
    if (updates.categoryId !== undefined) updateData.CategoryId = updates.categoryId;

    const updated = await postgresClient.update<ExpenseRequest>(
      'expense_requests',
      recordId,
      updateData
    );
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
