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
    }
  ): Promise<ExpenseCategory> {
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

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.label !== undefined) updateData.Label = updates.label;
    if (updates.code !== undefined) updateData.Code = updates.code;
    if (updates.description !== undefined) updateData.Description = updates.description;
    if (updates.requiresPreApproval !== undefined)
      updateData.RequiresPreApproval = updates.requiresPreApproval;
    if (updates.icon !== undefined) updateData.Icon = updates.icon;
    if (updates.color !== undefined) updateData.Color = updates.color;
    if (updates.isActive !== undefined) updateData.IsActive = updates.isActive;

    const updated = await postgresClient.update<ExpenseCategory>(
      'expense_categories',
      recordId,
      updateData
    );
    return updated;
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
