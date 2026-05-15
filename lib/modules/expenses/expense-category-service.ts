/**
 * Service - Gestion des Catégories de Dépenses
 * Module Dépenses
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { ExpenseCategory } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateExpenseCategoryInput {
  label: string;
  code: string;
  description?: string;
  requiresPreApproval: boolean;
  icon?: string;
  color?: string;
  workspaceId: string;
}

export class ExpenseCategoryService {
  async create(input: CreateExpenseCategoryInput): Promise<ExpenseCategory> {
    const category = {
      ExpenseCategoryId: uuidv4(),
      Label: input.label,
      Code: input.code,
      Description: input.description,
      RequiresPreApproval: input.requiresPreApproval,
      Icon: input.icon,
      Color: input.color,
      WorkspaceId: input.workspaceId,
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<ExpenseCategory>('expense_categories', category);
    return created;
  }

  async getById(categoryId: string): Promise<ExpenseCategory | null> {
    const categories = await postgresClient.list<ExpenseCategory>('expense_categories', {
      filterByFormula: `{expense_category_id} = '${categoryId}'`,
    });
    return categories.length > 0 ? categories[0] : null;
  }

  async list(
    workspaceId: string,
    filters: { isActive?: boolean } = {}
  ): Promise<ExpenseCategory[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.isActive !== undefined) {
      filterFormulas.push(`{is_active} = ${filters.isActive ? '1' : '0'}`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<ExpenseCategory>('expense_categories', {
      filterByFormula,
      sort: [{ field: 'Label', direction: 'asc' }],
    });
  }

  /**
   * Liste les catégories accessibles à un utilisateur donné selon ses rôles.
   * Une catégorie est accessible si :
   *   - allowed_role_ids est NULL ou vide (public, accessible à tous)
   *   - OU si l'un des rôles de l'utilisateur figure dans allowed_role_ids
   *
   * Utilise une requête SQL directe pour exploiter l'opérateur d'intersection
   * de tableaux Postgres `&&` (plus efficace qu'un filterByFormula côté JS).
   */
  async listAccessibleForUser(
    workspaceId: string,
    userRoleIds: string[],
    options: { onlyActive?: boolean } = { onlyActive: true }
  ): Promise<any[]> {
    const conds: string[] = ['workspace_id = $1'];
    const params: any[] = [workspaceId];

    if (options.onlyActive !== false) {
      conds.push('is_active = true');
    }

    // Soit pas de restriction (public), soit au moins un rôle de l'utilisateur autorisé.
    if (userRoleIds && userRoleIds.length > 0) {
      params.push(userRoleIds);
      conds.push(`(allowed_role_ids IS NULL OR cardinality(allowed_role_ids) = 0 OR allowed_role_ids && $${params.length}::uuid[])`);
    } else {
      // Utilisateur sans rôle : ne voit que les catégories publiques.
      conds.push('(allowed_role_ids IS NULL OR cardinality(allowed_role_ids) = 0)');
    }

    const r = await postgresClient.query<any>(
      `SELECT id, expense_category_id, label, code, description,
              requires_pre_approval, icon, color, is_active,
              allowed_role_ids, workspace_id, created_at, updated_at
       FROM expense_categories
       WHERE ${conds.join(' AND ')}
       ORDER BY label ASC`,
      params
    );
    return r.rows;
  }

  async update(
    categoryId: string,
    updates: {
      label?: string;
      code?: string;
      description?: string;
      requiresPreApproval?: boolean;
      icon?: string;
      color?: string;
      isActive?: boolean;
      allowedRoleIds?: string[] | null;  // null = supprimer la restriction
      chargeAccountId?: string | null;
      tvaAccountId?: string | null;
      tvaRate?: number;
    }
  ): Promise<any> {
    // Accepte UUID PK ou business code (expense_category_id)
    const sets: string[] = [];
    const params: any[] = [];
    const pushSet = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if (updates.label !== undefined)              pushSet('label', updates.label);
    if (updates.code !== undefined)               pushSet('code', updates.code);
    if (updates.description !== undefined)        pushSet('description', updates.description);
    if (updates.requiresPreApproval !== undefined)pushSet('requires_pre_approval', updates.requiresPreApproval);
    if (updates.icon !== undefined)               pushSet('icon', updates.icon);
    if (updates.color !== undefined)              pushSet('color', updates.color);
    if (updates.isActive !== undefined)           pushSet('is_active', updates.isActive);
    if (updates.allowedRoleIds !== undefined) {
      // null / tableau vide ⇒ accessible à tous (NULL en BDD)
      const arr = updates.allowedRoleIds && updates.allowedRoleIds.length > 0 ? updates.allowedRoleIds : null;
      params.push(arr);
      sets.push(`allowed_role_ids = $${params.length}::uuid[]`);
    }
    if (updates.chargeAccountId !== undefined)    pushSet('charge_account_id', updates.chargeAccountId);
    if (updates.tvaAccountId !== undefined)       pushSet('tva_account_id', updates.tvaAccountId);
    if (updates.tvaRate !== undefined)            pushSet('tva_rate', updates.tvaRate);

    if (sets.length === 0) {
      // Rien à mettre à jour : on retourne juste la version actuelle
      const r = await postgresClient.query<any>(
        `SELECT * FROM expense_categories WHERE id::text = $1 OR expense_category_id = $1 LIMIT 1`,
        [categoryId]
      );
      if (r.rows.length === 0) throw new Error('Catégorie non trouvée');
      return r.rows[0];
    }

    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(categoryId);
    const r = await postgresClient.query<any>(
      `UPDATE expense_categories SET ${sets.join(', ')}
       WHERE id::text = $${params.length} OR expense_category_id = $${params.length}
       RETURNING *`,
      params
    );
    if (r.rows.length === 0) throw new Error('Catégorie non trouvée');
    return r.rows[0];
  }

  async delete(categoryId: string): Promise<void> {
    const categories = await postgresClient.list<ExpenseCategory>('expense_categories', {
      filterByFormula: `{expense_category_id} = '${categoryId}'`,
    });

    if (categories.length === 0) {
      throw new Error('Catégorie non trouvée');
    }

    const recordId = categories[0].id;
    if (!recordId) {
      throw new Error('ID not found');
    }

    await postgresClient.delete('expense_categories', recordId);
  }
}
