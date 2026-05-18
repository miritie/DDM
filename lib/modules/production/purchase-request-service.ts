/**
 * Service - Sollicitations d'achat MP
 *
 * Greffe une vue "achat matières premières" sur le workflow existant
 * expense_requests → expense_approval_steps → expenses :
 *
 *   draft → submitted → approved → (déclenche création expense + déblocage fonds)
 *   (toute étape : rejected | cancelled)
 *
 * Réception : enregistrée via IngredientService.receive() qui met à jour
 * purchase_request_lines.qty_received / actual_total et trace dans
 * ingredient_receptions. La sollicitation est considérée "fully received"
 * quand toutes les lignes ont qty_received >= qty_requested.
 *
 * Catégorie d'expense utilisée : 'achat_mp' (seedée par migration).
 */
import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';
import { IngredientService } from './ingredient-service';

const db = getPostgresClient();
const ingredientService = new IngredientService();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUuid(table: string, slugCol: string | null, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  // Toujours vérifier l'existence en base. Accepte : UUID PK, slug business code,
  // ou UUID stocké à tort dans le slug column (bug data historique sur certaines
  // tables). Un UUID au format valide mais inexistant retourne null — évite la
  // propagation d'un id corrompu jusqu'à la FK.
  const where = slugCol ? `id::text = $1 OR ${slugCol} = $1` : `id::text = $1`;
  const r = await db.query(`SELECT id FROM ${table} WHERE ${where} LIMIT 1`, [value]);
  return r.rows[0]?.id ?? null;
}

const SELECT_PR = `
  SELECT
    er.id,
    er.expense_request_id   AS "ExpenseRequestId",
    er.request_number       AS "RequestNumber",
    er.title                AS "Title",
    er.description          AS "Description",
    er.amount               AS "Amount",
    er.category_id          AS "CategoryId",
    er.requester_id         AS "RequesterId",
    ru.user_id              AS "RequesterUserId",
    er.status               AS "Status",
    er.submitted_at         AS "SubmittedAt",
    er.workspace_id         AS "WorkspaceId",
    er.created_at           AS "CreatedAt",
    er.updated_at           AS "UpdatedAt",
    ec.code                 AS "CategoryCode",
    e.status::text          AS "ExpenseStatus",
    e.payment_date          AS "ExpensePaidAt"
  FROM expense_requests er
  LEFT JOIN expense_categories ec ON ec.id = er.category_id
  LEFT JOIN users ru ON ru.id = er.requester_id
  LEFT JOIN expenses e ON e.expense_request_id = er.id
`;

const SELECT_PRL = `
  SELECT
    prl.id,
    prl.purchase_request_line_id  AS "PurchaseRequestLineId",
    prl.expense_request_id        AS "ExpenseRequestId",
    prl.ingredient_id             AS "IngredientId",
    prl.ingredient_name           AS "IngredientName",
    prl.supplier_account_id       AS "SupplierAccountId",
    prl.qty_requested             AS "QtyRequested",
    prl.unit                      AS "Unit",
    prl.estimated_unit_price      AS "EstimatedUnitPrice",
    prl.estimated_total           AS "EstimatedTotal",
    prl.qty_received              AS "QtyReceived",
    prl.actual_total              AS "ActualTotal",
    prl.notes                     AS "Notes",
    prl.production_order_id       AS "ProductionOrderId",
    po.order_number               AS "ProductionOrderNumber",
    prl.created_at                AS "CreatedAt",
    prl.updated_at                AS "UpdatedAt"
  FROM purchase_request_lines prl
  LEFT JOIN production_orders po ON po.id = prl.production_order_id
`;

export interface CreatePurchaseRequestInput {
  workspaceId: string;
  requesterId: string;          // user_id ou UUID
  title?: string;
  description?: string;
  productionOrderId?: string;   // optionnel : sollicitation faite pour un OP spécifique. Propagé sur toutes les lignes.
  lines: Array<{
    ingredientId: string;
    qtyRequested: number;
    unit?: string;
    estimatedUnitPrice: number;
    supplierAccountId?: string | null;
    notes?: string;
  }>;
}

export class PurchaseRequestService {

  /**
   * Récupère l'UUID de la catégorie 'achat_mp' pour le workspace donné.
   * Lève une erreur explicite si la catégorie n'a pas été seedée
   * (= migration production v1 pas appliquée).
   */
  private async getMpCategoryId(workspaceUuid: string): Promise<string> {
    const r = await db.query(
      `SELECT id FROM expense_categories
       WHERE workspace_id = $1 AND code = 'achat_mp' LIMIT 1`,
      [workspaceUuid]
    );
    if (r.rowCount === 0) {
      throw new Error(
        'Catégorie d\'expense "achat_mp" introuvable — exécuter npm run migrate:production:v1'
      );
    }
    return r.rows[0].id;
  }

  private async generateRequestNumber(workspaceUuid: string): Promise<string> {
    const now = new Date();
    const prefix = `PR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const r = await db.query(
      `SELECT request_number FROM expense_requests
       WHERE workspace_id = $1 AND request_number LIKE $2
       ORDER BY request_number DESC LIMIT 1`,
      [workspaceUuid, `${prefix}%`]
    );
    let next = 1;
    if (r.rows[0]) {
      const m = r.rows[0].request_number.match(/-(\d+)$/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  async list(workspaceId: string, filters?: {
    status?: string;
    requesterId?: string;
  }): Promise<any[]> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) return [];

    const conds: string[] = [`er.workspace_id = $1`, `ec.code = 'achat_mp'`];
    const params: any[] = [wsUuid];

    if (filters?.status) { params.push(filters.status); conds.push(`er.status = $${params.length}`); }
    if (filters?.requesterId) {
      const u = await resolveUuid('users', 'user_id', filters.requesterId);
      if (u) { params.push(u); conds.push(`er.requester_id = $${params.length}`); }
    }

    const r = await db.query(
      `${SELECT_PR} WHERE ${conds.join(' AND ')} ORDER BY er.created_at DESC LIMIT 200`,
      params
    );
    const rows = r.rows;
    if (rows.length === 0) return rows;

    // Charge TOUTES les lignes en 1 seule requête (au lieu d'un SELECT par PR).
    // Gain : sur une liste de 50 PR, on passe de 51 requêtes à 2.
    const prIds = rows.map((r: any) => r.id);
    const linesR = await db.query(
      `${SELECT_PRL} WHERE prl.expense_request_id = ANY($1::uuid[]) ORDER BY prl.created_at ASC`,
      [prIds]
    );
    const linesByPr = new Map<string, any[]>();
    for (const line of linesR.rows) {
      const k = line.ExpenseRequestId;
      if (!linesByPr.has(k)) linesByPr.set(k, []);
      linesByPr.get(k)!.push(line);
    }
    for (const row of rows) {
      row.Lines = linesByPr.get(row.id) || [];
    }
    return rows;
  }

  async getById(idOrSlug: string): Promise<any | null> {
    const r = await db.query(
      `${SELECT_PR} WHERE er.id::text = $1 OR er.expense_request_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    if (r.rowCount === 0) return null;
    const row = r.rows[0];
    if (row.CategoryCode !== 'achat_mp') return null; // pas un PR d'achat MP
    row.Lines = await this.getLines(row.id);
    return row;
  }

  async getLines(prUuid: string): Promise<any[]> {
    const r = await db.query(
      `${SELECT_PRL} WHERE prl.expense_request_id = $1 ORDER BY prl.created_at ASC`,
      [prUuid]
    );
    return r.rows;
  }

  async create(input: CreatePurchaseRequestInput): Promise<any> {
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Une sollicitation doit contenir au moins une ligne');
    }
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', input.workspaceId);
    if (!wsUuid) throw new Error('Workspace introuvable');
    const requesterUuid = await resolveUuid('users', 'user_id', input.requesterId);
    if (!requesterUuid) throw new Error('Demandeur introuvable');

    const categoryId = await this.getMpCategoryId(wsUuid);
    const requestNumber = await this.generateRequestNumber(wsUuid);
    const erSlug = `ER-${uuidv4().slice(0, 8)}`;

    // Lien optionnel avec un OP : résolu une seule fois pour toutes les lignes.
    const productionOrderUuid = input.productionOrderId
      ? await resolveUuid('production_orders', 'production_order_id', input.productionOrderId)
      : null;
    if (input.productionOrderId && !productionOrderUuid) {
      throw new Error(`Ordre de production introuvable : ${input.productionOrderId}`);
    }

    // Calcul du montant total estimé
    let totalEstimated = 0;
    for (const l of input.lines) {
      totalEstimated += Number(l.qtyRequested) * Number(l.estimatedUnitPrice);
    }

    const prUuid = await db.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO expense_requests (
           expense_request_id, request_number, title, description,
           amount, category_id, requester_id, status, workspace_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8)
         RETURNING id`,
        [
          erSlug, requestNumber,
          input.title ?? `Achat matières premières ${requestNumber}`,
          input.description ?? null,
          totalEstimated, categoryId, requesterUuid, wsUuid,
        ]
      );
      const prUuid = ins.rows[0].id;

      for (const line of input.lines) {
        const ingUuid = await resolveUuid('ingredients', 'ingredient_id', line.ingredientId);
        if (!ingUuid) throw new Error(`Ingrédient ${line.ingredientId} introuvable`);
        const ingMeta = await client.query(
          `SELECT name, unit FROM ingredients WHERE id = $1`,
          [ingUuid]
        );
        const supplierUuid = line.supplierAccountId
          ? await resolveUuid('accounts', 'account_id', line.supplierAccountId)
          : null;
        const estimatedTotal = Number(line.qtyRequested) * Number(line.estimatedUnitPrice);

        await client.query(
          `INSERT INTO purchase_request_lines (
             purchase_request_line_id, expense_request_id, ingredient_id, ingredient_name,
             supplier_account_id, qty_requested, unit, estimated_unit_price, estimated_total,
             qty_received, actual_total, notes, production_order_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,$10,$11)`,
          [
            `PRL-${uuidv4().slice(0, 8)}`, prUuid, ingUuid, ingMeta.rows[0]?.name ?? null,
            supplierUuid, line.qtyRequested, line.unit ?? ingMeta.rows[0]?.unit ?? 'unit',
            line.estimatedUnitPrice, estimatedTotal, line.notes ?? null, productionOrderUuid,
          ]
        );
      }
      return prUuid;
    });

    return (await this.getById(prUuid))!;
  }

  async submit(idOrSlug: string): Promise<any> {
    const pr = await this.getById(idOrSlug);
    if (!pr) throw new Error('Sollicitation introuvable');
    if (pr.Status !== 'draft') {
      throw new Error(`Seule une sollicitation en brouillon peut être soumise (statut actuel : ${pr.Status})`);
    }
    await db.query(
      `UPDATE expense_requests SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP,
                                    updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [pr.id]
    );
    return await this.getById(pr.id);
  }

  /**
   * Admin approuve → fonds automatiquement débloqués via création d'une expense.
   */
  async approve(idOrSlug: string, approverId: string): Promise<{ purchaseRequest: any; expenseId: string }> {
    const pr = await this.getById(idOrSlug);
    if (!pr) throw new Error('Sollicitation introuvable');
    if (pr.Status !== 'submitted') {
      throw new Error(`Seule une sollicitation soumise peut être approuvée (statut actuel : ${pr.Status})`);
    }
    const approverUuid = await resolveUuid('users', 'user_id', approverId);
    if (!approverUuid) throw new Error('Validateur introuvable');
    // Séparation des pouvoirs : l'approbateur ne peut pas être le requester.
    // Même si l'UI le cache, on rejette ici en défense en profondeur.
    if (approverUuid === pr.RequesterId) {
      throw new Error("Vous ne pouvez pas approuver une sollicitation que vous avez soumise. Un autre administrateur doit le faire (séparation des pouvoirs).");
    }

    const expenseId = await db.transaction(async (client) => {
      // 1. Marquer la sollicitation approuvée
      await client.query(
        `UPDATE expense_requests SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [pr.id]
      );

      // 2. Enregistrer l'approbation dans expense_approval_steps
      const stepR = await client.query(
        `SELECT COALESCE(MAX(step_order), 0) + 1 AS next_order
         FROM expense_approval_steps WHERE expense_request_id = $1`,
        [pr.id]
      );
      await client.query(
        `INSERT INTO expense_approval_steps (
           approval_step_id, expense_request_id, approver_id, step_order,
           status, processed_at
         ) VALUES ($1,$2,$3,$4,'approved',CURRENT_TIMESTAMP)`,
        [`EAS-${uuidv4().slice(0, 8)}`, pr.id, approverUuid, stepR.rows[0].next_order]
      );

      // 3. Créer automatiquement l'expense (= déblocage des fonds, option (a))
      const expenseNumber = await (async () => {
        const now = new Date();
        const prefix = `EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const r = await client.query(
          `SELECT expense_number FROM expenses
           WHERE workspace_id = $1 AND expense_number LIKE $2
           ORDER BY expense_number DESC LIMIT 1`,
          [pr.WorkspaceId, `${prefix}%`]
        );
        let n = 1;
        if (r.rows[0]) {
          const m = r.rows[0].expense_number.match(/-(\d+)$/);
          if (m) n = parseInt(m[1], 10) + 1;
        }
        return `${prefix}-${String(n).padStart(4, '0')}`;
      })();

      const exp = await client.query(
        `INSERT INTO expenses (
           expense_id, expense_number, expense_request_id, title, description,
           amount, category_id, payer_id, status, workspace_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'approved',$9)
         RETURNING id`,
        [
          `EXP-${uuidv4().slice(0, 8)}`, expenseNumber, pr.id,
          pr.Title, pr.Description, pr.Amount,
          pr.CategoryId, approverUuid, pr.WorkspaceId,
        ]
      );
      return exp.rows[0].id;
    });

    return {
      purchaseRequest: await this.getById(pr.id),
      expenseId,
    };
  }

  async reject(idOrSlug: string, reason?: string): Promise<any> {
    const pr = await this.getById(idOrSlug);
    if (!pr) throw new Error('Sollicitation introuvable');
    if (pr.Status === 'approved' || pr.Status === 'rejected' || pr.Status === 'cancelled') {
      throw new Error(`Sollicitation déjà finalisée (statut actuel : ${pr.Status})`);
    }
    await db.query(
      `UPDATE expense_requests
         SET status = 'rejected', description = COALESCE(description, '') || $2,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [pr.id, reason ? `\n[REJET] ${reason}` : '\n[REJET]']
    );
    return await this.getById(pr.id);
  }

  /**
   * Enregistre la réception d'une ligne. Délègue à IngredientService.receive()
   * qui s'occupe du recalcul PMP + de la trace dans ingredient_receptions.
   * La ligne purchase_request_lines.qty_received/actual_total est mise à jour
   * par receive() également.
   */
  async receiveLine(input: {
    purchaseRequestLineId: string;
    qty: number;
    unitPrice: number;
    receivedById: string;
    notes?: string;
  }): Promise<any> {
    const prl = await db.query(
      `${SELECT_PRL} WHERE prl.id::text = $1 OR prl.purchase_request_line_id = $1 LIMIT 1`,
      [input.purchaseRequestLineId]
    );
    if (prl.rowCount === 0) throw new Error('Ligne d\'achat introuvable');
    const line = prl.rows[0];

    // Récupère l'expense associée pour lier la réception
    const expR = await db.query(
      `SELECT id FROM expenses WHERE expense_request_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [line.ExpenseRequestId]
    );
    const expenseUuid = expR.rows[0]?.id ?? null;

    const result = await ingredientService.receive({
      ingredientId: line.IngredientId,
      qty: input.qty,
      unitPrice: input.unitPrice,
      supplierAccountId: line.SupplierAccountId,
      purchaseRequestLineId: line.id,
      receivedById: input.receivedById,
      expenseId: expenseUuid,
      notes: input.notes,
    });

    return result;
  }

  /**
   * Récapitulatif : combien reçu, combien reste à recevoir, fully received ?
   */
  async getReceptionStatus(idOrSlug: string): Promise<{
    totalRequested: number;
    totalReceived: number;
    totalActualCost: number;
    fullyReceived: boolean;
    linesCount: number;
    linesReceived: number;
  }> {
    const pr = await this.getById(idOrSlug);
    if (!pr) throw new Error('Sollicitation introuvable');
    const lines = pr.Lines as any[];
    let totalRequested = 0, totalReceived = 0, totalActualCost = 0, linesReceived = 0;
    for (const l of lines) {
      const req = Number(l.QtyRequested);
      const rec = Number(l.QtyReceived);
      totalRequested += req;
      totalReceived += rec;
      totalActualCost += Number(l.ActualTotal);
      if (rec >= req) linesReceived++;
    }
    return {
      totalRequested,
      totalReceived,
      totalActualCost,
      fullyReceived: linesReceived === lines.length,
      linesCount: lines.length,
      linesReceived,
    };
  }
}
