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

  /**
   * Liste paginée des demandes avec filtres serveur.
   *
   * Tous les filtres sont appliqués côté Postgres (auparavant on chargeait
   * tout et on filtrait en JS, ce qui était mortel en 3G dès qu'on dépassait
   * quelques centaines de demandes).
   *
   * Retourne aussi le label de la catégorie via JOIN pour éviter un second
   * fetch côté client.
   */
  async list(
    workspaceId: string,
    filters: {
      status?: string;
      requesterId?: string;
      categoryId?: string;
      search?: string;          // recherche texte sur title / request_number
      startDate?: string;       // YYYY-MM-DD (created_at >=)
      endDate?: string;         // YYYY-MM-DD (created_at <=)
      limit?: number;           // défaut 50
      offset?: number;          // défaut 0
    } = {}
  ): Promise<any[]> {
    const conds: string[] = ['er.workspace_id = $1'];
    const params: any[] = [workspaceId];
    const push = (sql: string, val: any) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };

    if (filters.status)      push('er.status = ?', filters.status);
    if (filters.requesterId) push('er.requester_id = ?', filters.requesterId);
    if (filters.categoryId)  push('er.category_id = ?', filters.categoryId);
    if (filters.startDate)   push('er.created_at >= ?', filters.startDate);
    if (filters.endDate)     push('er.created_at <= ?', filters.endDate + ' 23:59:59');
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conds.push(`(er.title ILIKE $${params.length} OR er.request_number ILIKE $${params.length})`);
    }

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);

    const r = await postgresClient.query<any>(
      `SELECT
         er.id,
         er.expense_request_id  AS "ExpenseRequestId",
         er.request_number      AS "RequestNumber",
         er.title               AS "Title",
         er.description         AS "Description",
         er.amount              AS "Amount",
         er.category_id         AS "CategoryId",
         er.expense_type_id     AS "ExpenseTypeId",
         er.requester_id        AS "RequesterId",
         er.status              AS "Status",
         er.submitted_at        AS "SubmittedAt",
         er.workspace_id        AS "WorkspaceId",
         er.created_at          AS "CreatedAt",
         er.updated_at          AS "UpdatedAt",
         ec.label               AS "CategoryLabel",
         ec.code                AS "CategoryCode",
         et.label               AS "TypeLabel"
       FROM expense_requests er
       LEFT JOIN expense_categories ec ON ec.id = er.category_id
       LEFT JOIN expense_types et      ON et.id = er.expense_type_id
       WHERE ${conds.join(' AND ')}
       ORDER BY er.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return r.rows;
  }

  /** Compte total avec mêmes filtres (pour la pagination UI). */
  async count(
    workspaceId: string,
    filters: { status?: string; requesterId?: string; categoryId?: string; search?: string; startDate?: string; endDate?: string } = {}
  ): Promise<number> {
    const conds: string[] = ['workspace_id = $1'];
    const params: any[] = [workspaceId];
    const push = (sql: string, val: any) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };
    if (filters.status)      push('status = ?', filters.status);
    if (filters.requesterId) push('requester_id = ?', filters.requesterId);
    if (filters.categoryId)  push('category_id = ?', filters.categoryId);
    if (filters.startDate)   push('created_at >= ?', filters.startDate);
    if (filters.endDate)     push('created_at <= ?', filters.endDate + ' 23:59:59');
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conds.push(`(title ILIKE $${params.length} OR request_number ILIKE $${params.length})`);
    }
    const r = await postgresClient.query<any>(
      `SELECT COUNT(*)::int AS n FROM expense_requests WHERE ${conds.join(' AND ')}`,
      params
    );
    return r.rows[0]?.n || 0;
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
