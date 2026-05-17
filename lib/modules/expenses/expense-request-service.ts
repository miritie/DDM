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
  expenseTypeId?: string;          // optionnel : type prédéfini sous la catégorie
  customTypeLabel?: string;        // optionnel : type saisi libre par l'utilisateur,
                                   //   à classifier ensuite (admin / IA → OHADA).
                                   //   Mutuellement exclusif avec expenseTypeId.
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

    // Convention de l'app : getCurrentUserId() retourne le business code
    // user_id (USR-…). La FK expense_requests.requester_id est UUID PK —
    // on résout ici avant l'INSERT pour éviter "invalid input syntax for type uuid".
    const requesterUuid = await this.resolveUserUuid(input.requesterId);

    const request: any = {
      ExpenseRequestId: uuidv4(),
      RequestNumber: requestNumber,
      Title: input.title,
      Description: input.description,
      Amount: input.amount,
      CategoryId: input.categoryId,
      RequesterId: requesterUuid,
      Status: 'draft' as ExpenseRequestStatus,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      ...(input.expenseTypeId ? { ExpenseTypeId: input.expenseTypeId } : {}),
      ...(input.customTypeLabel && !input.expenseTypeId
        ? { CustomTypeLabel: input.customTypeLabel.trim() }
        : {}),
    };

    const created = await postgresClient.create<ExpenseRequest>('expense_requests', request);
    return created;
  }

  /**
   * Accepte UUID PK ou business code user_id et retourne l'UUID PK.
   * Nécessaire car la session véhicule le business code (cf. auth-options.ts).
   */
  private async resolveUserUuid(idOrSlug: string): Promise<string> {
    const r = await postgresClient.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    if (r.rows.length === 0) throw new Error('Utilisateur introuvable');
    return r.rows[0].id;
  }

  async getById(requestId: string): Promise<any | null> {
    const requests = await postgresClient.list<ExpenseRequest>('expense_requests', {
      filterByFormula: `{expense_request_id} = '${requestId}'`,
    });
    if (requests.length === 0) return null;
    const req = requests[0] as any;

    // Enrichir avec les infos de la catégorie (label + code).
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

    // Enrichir avec le nom du demandeur (la page détail l'affiche).
    if (req.RequesterId) {
      const uR = await postgresClient.query<any>(
        `SELECT user_id, full_name, display_name FROM users WHERE id = $1 LIMIT 1`,
        [req.RequesterId]
      );
      if (uR.rows[0]) {
        req.RequesterName = uR.rows[0].full_name || uR.rows[0].display_name || uR.rows[0].user_id;
        req.RequesterSlug = uR.rows[0].user_id;
      }
    }

    // Alias pour compat UI legacy qui lit RequestDate.
    req.RequestDate = req.CreatedAt;

    // Statut effectif = celui de l'expense liée (qui va plus loin que le
    // request : scheduled, paid). Le RequestStatus original est conservé
    // pour les UI qui en auraient besoin.
    if (req.id) {
      const eR = await postgresClient.query<any>(
        `SELECT status, scheduled_payment_date, payment_date
         FROM expenses WHERE expense_request_id = $1 LIMIT 1`,
        [req.id]
      );
      if (eR.rows[0]) {
        req.RequestStatus = req.Status;
        req.Status = eR.rows[0].status;
        req.ScheduledPaymentDate = eR.rows[0].scheduled_payment_date;
        req.PaymentDate = eR.rows[0].payment_date;
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

    // requesterId peut être l'UUID PK ou le business code (USR-…) selon
    // l'appelant (page Mes demandes : 'me' → business code via la session,
    // page admin : UUID via picker). On résout côté serveur pour éviter
    // "invalid input syntax for type uuid".
    let requesterUuid: string | undefined;
    if (filters.requesterId) {
      requesterUuid = await this.resolveUserUuid(filters.requesterId);
    }

    if (filters.status)      push('er.status = ?', filters.status);
    if (requesterUuid)       push('er.requester_id = ?', requesterUuid);
    if (filters.categoryId)  push('er.category_id = ?', filters.categoryId);
    if (filters.startDate)   push('er.created_at >= ?', filters.startDate);
    if (filters.endDate)     push('er.created_at <= ?', filters.endDate + ' 23:59:59');
    if (filters.search) {
      params.push(`%${filters.search}%`);
      conds.push(`(er.title ILIKE $${params.length} OR er.request_number ILIKE $${params.length})`);
    }

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);

    // Le "statut effectif" pour la timeline UI = COALESCE(expense.status, request.status).
    // L'enum expense_request_status s'arrête à 'approved' alors que l'expense
    // continue ensuite vers 'scheduled' puis 'paid'. Sans cette jointure, le
    // demandeur voyait sa demande figée sur "approved" même après paiement
    // côté comptable.
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
         er.status              AS "RequestStatus",
         COALESCE(e.status::text, er.status::text) AS "Status",
         e.scheduled_payment_date AS "ScheduledPaymentDate",
         e.payment_date           AS "PaymentDate",
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
       LEFT JOIN expenses e            ON e.expense_request_id = er.id
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

    let requesterUuid: string | undefined;
    if (filters.requesterId) {
      requesterUuid = await this.resolveUserUuid(filters.requesterId);
    }

    if (filters.status)      push('status = ?', filters.status);
    if (requesterUuid)       push('requester_id = ?', requesterUuid);
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

    const recordId = (requests[0] as any).Id ?? (requests[0] as any).id;
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
    const recordId = (req as any).Id ?? (req as any).id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    // Résolution : approverId est un business code (USR-…) ;
    // expense_approval_steps.expense_request_id et .approver_id sont des UUID.
    const approverUuid = await this.resolveUserUuid(input.approverId);

    // Create approval step record
    const approvalStep = {
      ApprovalStepId: uuidv4(),
      ExpenseRequestId: recordId,  // UUID PK de l'expense_request (pas le business code)
      ApproverId: approverUuid,
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

    // Notifier le demandeur de la décision (fail-safe).
    try {
      const { getNotificationService } = await import('@/lib/modules/notifications/notification-service');
      const notif = getNotificationService();
      await notif.create({
        workspaceId: req.WorkspaceId,
        recipientId: req.RequesterId,
        category: input.status === 'approved' ? 'expense_approved' : 'expense_rejected',
        subject: input.status === 'approved'
          ? `Demande "${req.Title}" approuvée`
          : `Demande "${req.Title}" refusée`,
        message: input.status === 'approved'
          ? `Ta demande de ${Number(req.Amount).toLocaleString('fr-FR')} XOF a été approuvée${input.comments ? ` : ${input.comments}` : '.'} Le comptable peut maintenant procéder au paiement.`
          : `Ta demande de ${Number(req.Amount).toLocaleString('fr-FR')} XOF a été refusée${input.comments ? ` : ${input.comments}` : '.'}`,
        entityType: 'expense_request',
        entityId: recordId,
        actionUrl: `/expenses/requests/${req.ExpenseRequestId}`,
      });
    } catch (e: any) {
      console.error('[expense.approve] notif échec :', e.message);
    }

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
            approverUuid,  // payeur provisoire = approbateur (UUID PK), le comptable peut le changer au paiement
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

    const recordId = (requests[0] as any).Id ?? (requests[0] as any).id;
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

    const recordId = (requests[0] as any).Id ?? (requests[0] as any).id;
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
