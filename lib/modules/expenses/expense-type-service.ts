/**
 * Service — Types de dépense (poste précis sous une catégorie)
 *
 * Hiérarchie : expense_categories > expense_types > expense_requests/expenses.
 * Au moment du paiement et de la génération de l'écriture comptable, le
 * système utilise EN PRIORITÉ les attributs du type (charge_account, tva,
 * tva_rate). Si l'un d'eux est NULL → fallback sur la catégorie parente.
 *
 * resolveAccountingMapping() encapsule cette logique de fallback.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();

export interface CreateExpenseTypeInput {
  categoryId: string;             // UUID PK ou code business
  label: string;
  code: string;
  description?: string;
  chargeAccountId?: string | null;
  tvaAccountId?: string | null;
  tvaRate?: number;
  allowedRoleIds?: string[] | null;
  isActive?: boolean;
  workspaceId: string;
}

export interface UpdateExpenseTypeInput {
  label?: string;
  code?: string;
  description?: string | null;
  chargeAccountId?: string | null;
  tvaAccountId?: string | null;
  tvaRate?: number | null;
  allowedRoleIds?: string[] | null;
  isActive?: boolean;
}

export class ExpenseTypeService {
  async list(workspaceId: string, filters: { categoryId?: string; isActive?: boolean } = {}): Promise<any[]> {
    const conds: string[] = ['t.workspace_id = $1'];
    const params: any[] = [workspaceId];
    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      conds.push(`t.is_active = $${params.length}`);
    }
    if (filters.categoryId) {
      const catR = await db.query<any>(
        `SELECT id FROM expense_categories WHERE id::text = $1 OR code = $1 LIMIT 1`,
        [filters.categoryId]
      );
      if (catR.rows[0]) {
        params.push(catR.rows[0].id);
        conds.push(`t.category_id = $${params.length}`);
      }
    }
    const r = await db.query<any>(
      `SELECT t.*, c.label AS category_label, c.code AS category_code,
              ca.account_number AS charge_account_number, ca.label AS charge_account_label,
              tva.account_number AS tva_account_number
       FROM expense_types t
       JOIN expense_categories c ON c.id = t.category_id
       LEFT JOIN chart_accounts ca ON ca.id = t.charge_account_id
       LEFT JOIN chart_accounts tva ON tva.id = t.tva_account_id
       WHERE ${conds.join(' AND ')}
       ORDER BY c.label, t.label`,
      params
    );
    return r.rows;
  }

  /**
   * Liste les types accessibles à un utilisateur donné (selon ses rôles).
   * Cascade : si type.allowed_role_ids défini → utilisé. Sinon → on hérite
   * de la catégorie parente.
   */
  async listAccessibleForUser(workspaceId: string, userRoleIds: string[]): Promise<any[]> {
    const params: any[] = [workspaceId];
    let roleCond = '';
    if (userRoleIds && userRoleIds.length > 0) {
      params.push(userRoleIds);
      roleCond = `
        AND (
          -- Niveau type : si renseigné, doit matcher
          (t.allowed_role_ids IS NOT NULL AND cardinality(t.allowed_role_ids) > 0 AND t.allowed_role_ids && $${params.length}::uuid[])
          OR
          -- Sinon : on regarde la catégorie
          (
            (t.allowed_role_ids IS NULL OR cardinality(t.allowed_role_ids) = 0)
            AND (
              c.allowed_role_ids IS NULL OR cardinality(c.allowed_role_ids) = 0
              OR c.allowed_role_ids && $${params.length}::uuid[]
            )
          )
        )`;
    } else {
      roleCond = `
        AND (t.allowed_role_ids IS NULL OR cardinality(t.allowed_role_ids) = 0)
        AND (c.allowed_role_ids IS NULL OR cardinality(c.allowed_role_ids) = 0)`;
    }
    const r = await db.query<any>(
      `SELECT t.id, t.expense_type_id, t.label, t.code, t.description,
              t.tva_rate, t.is_active,
              c.id AS category_id, c.label AS category_label, c.code AS category_code,
              ca.account_number AS charge_account_number, ca.label AS charge_account_label
       FROM expense_types t
       JOIN expense_categories c ON c.id = t.category_id
       LEFT JOIN chart_accounts ca ON ca.id = COALESCE(t.charge_account_id, c.charge_account_id)
       WHERE t.workspace_id = $1
         AND t.is_active = true
         AND c.is_active = true
         ${roleCond}
       ORDER BY c.label, t.label`,
      params
    );
    return r.rows;
  }

  async getById(idOrCode: string): Promise<any | null> {
    const r = await db.query<any>(
      `SELECT t.*, c.label AS category_label, c.code AS category_code
       FROM expense_types t
       JOIN expense_categories c ON c.id = t.category_id
       WHERE t.id::text = $1 OR t.expense_type_id = $1 OR t.code = $1
       LIMIT 1`,
      [idOrCode]
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateExpenseTypeInput): Promise<any> {
    // Résolution categoryId (UUID PK ou code)
    const catR = await db.query<any>(
      `SELECT id FROM expense_categories WHERE (id::text = $1 OR code = $1) AND workspace_id = $2 LIMIT 1`,
      [input.categoryId, input.workspaceId]
    );
    if (catR.rows.length === 0) throw new Error('Catégorie introuvable');

    const r = await db.query<any>(
      `INSERT INTO expense_types (
         expense_type_id, category_id, label, code, description,
         charge_account_id, tva_account_id, tva_rate, allowed_role_ids,
         is_active, workspace_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        `ET-${uuidv4().slice(0, 8)}`,
        catR.rows[0].id,
        input.label,
        input.code,
        input.description ?? null,
        input.chargeAccountId ?? null,
        input.tvaAccountId ?? null,
        input.tvaRate ?? null,
        input.allowedRoleIds && input.allowedRoleIds.length > 0 ? input.allowedRoleIds : null,
        input.isActive ?? true,
        input.workspaceId,
      ]
    );
    return r.rows[0];
  }

  async update(idOrCode: string, updates: UpdateExpenseTypeInput): Promise<any> {
    const sets: string[] = [];
    const params: any[] = [];
    const push = (col: string, v: any) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (updates.label !== undefined)            push('label', updates.label);
    if (updates.code !== undefined)             push('code', updates.code);
    if (updates.description !== undefined)      push('description', updates.description);
    if (updates.chargeAccountId !== undefined)  push('charge_account_id', updates.chargeAccountId);
    if (updates.tvaAccountId !== undefined)     push('tva_account_id', updates.tvaAccountId);
    if (updates.tvaRate !== undefined)          push('tva_rate', updates.tvaRate);
    if (updates.isActive !== undefined)         push('is_active', updates.isActive);
    if (updates.allowedRoleIds !== undefined) {
      const arr = updates.allowedRoleIds && updates.allowedRoleIds.length > 0 ? updates.allowedRoleIds : null;
      params.push(arr);
      sets.push(`allowed_role_ids = $${params.length}::uuid[]`);
    }
    if (sets.length === 0) return await this.getById(idOrCode);
    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(idOrCode);
    const r = await db.query<any>(
      `UPDATE expense_types SET ${sets.join(', ')}
       WHERE id::text = $${params.length} OR expense_type_id = $${params.length} OR code = $${params.length}
       RETURNING *`,
      params
    );
    if (r.rows.length === 0) throw new Error('Type introuvable');
    return r.rows[0];
  }

  async delete(idOrCode: string): Promise<void> {
    await db.query(
      `DELETE FROM expense_types
       WHERE id::text = $1 OR expense_type_id = $1 OR code = $1`,
      [idOrCode]
    );
  }

  /**
   * Résout le mapping comptable final pour un (expenseRequestId ou expenseId)
   * en faisant le fallback type → catégorie. Utilisé par
   * JournalGenerationService pour décider quel compte de charge / TVA / taux
   * utiliser au moment du paiement.
   *
   * @param ids — un objet { expenseId, expenseRequestId } : on prend le plus
   * spécifique disponible.
   */
  async resolveAccountingMapping(opts: { expenseId?: string; expenseRequestId?: string }): Promise<{
    chargeAccountId: string | null;
    tvaAccountId: string | null;
    tvaRate: number;
    typeLabel: string | null;
    categoryLabel: string | null;
  } | null> {
    let typeId: string | null = null;
    let categoryId: string | null = null;

    if (opts.expenseId) {
      const r = await db.query<any>(
        `SELECT expense_type_id, category_id FROM expenses WHERE id::text = $1 OR expense_id = $1 LIMIT 1`,
        [opts.expenseId]
      );
      if (r.rows[0]) { typeId = r.rows[0].expense_type_id; categoryId = r.rows[0].category_id; }
    }
    if (!typeId && opts.expenseRequestId) {
      const r = await db.query<any>(
        `SELECT expense_type_id, category_id FROM expense_requests WHERE id::text = $1 OR expense_request_id = $1 LIMIT 1`,
        [opts.expenseRequestId]
      );
      if (r.rows[0]) { typeId = typeId || r.rows[0].expense_type_id; categoryId = categoryId || r.rows[0].category_id; }
    }

    if (!typeId && !categoryId) return null;

    const r = await db.query<any>(
      `SELECT
         t.label AS type_label,
         t.charge_account_id AS t_charge, t.tva_account_id AS t_tva, t.tva_rate AS t_rate,
         c.label AS cat_label,
         c.charge_account_id AS c_charge, c.tva_account_id AS c_tva, c.tva_rate AS c_rate
       FROM expense_categories c
       LEFT JOIN expense_types t ON t.id = $1
       WHERE c.id = $2
       LIMIT 1`,
      [typeId, categoryId]
    );
    if (r.rows.length === 0) return null;
    const x = r.rows[0];
    return {
      chargeAccountId: x.t_charge ?? x.c_charge ?? null,
      tvaAccountId:    x.t_tva    ?? x.c_tva    ?? null,
      tvaRate:         Number(x.t_rate ?? x.c_rate ?? 0),
      typeLabel:       x.type_label ?? null,
      categoryLabel:   x.cat_label ?? null,
    };
  }
}
