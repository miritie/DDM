/**
 * Service - Gestion des Catégories de Dépenses
 * Module Dépenses
 */

import { AirtableClient } from '@/lib/airtable/client';
import { ExpenseCategory } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
    const category: Partial<ExpenseCategory> = {
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

    const created = await airtableClient.create<ExpenseCategory>('ExpenseCategory', category);
    if (!created) {
      throw new Error('Failed to create expense category - Airtable not configured');
    }
    return created;
  }

  async getById(categoryId: string): Promise<ExpenseCategory | null> {
    const categories = await airtableClient.list<ExpenseCategory>('ExpenseCategory', {
      filterByFormula: `{ExpenseCategoryId} = '${categoryId}'`,
    });
    return categories.length > 0 ? categories[0] : null;
  }

  async list(
    workspaceId: string,
    filters: { isActive?: boolean } = {}
  ): Promise<ExpenseCategory[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.isActive !== undefined) {
      filterFormulas.push(`{IsActive} = ${filters.isActive ? '1' : '0'}`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await airtableClient.list<ExpenseCategory>('ExpenseCategory', {
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
    const categories = await airtableClient.list<ExpenseCategory>('ExpenseCategory', {
      filterByFormula: `{ExpenseCategoryId} = '${categoryId}'`,
    });

    if (categories.length === 0) {
      throw new Error('Catégorie non trouvée');
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

    const updated = await airtableClient.update<ExpenseCategory>(
      'ExpenseCategory',
      (categories[0] as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update expense category - Airtable not configured');
    }
    return updated;
  }

  async delete(categoryId: string): Promise<void> {
    const categories = await airtableClient.list<ExpenseCategory>('ExpenseCategory', {
      filterByFormula: `{ExpenseCategoryId} = '${categoryId}'`,
    });

    if (categories.length === 0) {
      throw new Error('Catégorie non trouvée');
    }

    await airtableClient.delete('ExpenseCategory', (categories[0] as any)._recordId);
  }
}
