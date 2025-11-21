/**
 * Service - Gestion des Ingrédients / Matières Premières
 * Module Production & Usine
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Ingredient } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateIngredientInput {
  name: string;
  code: string;
  description?: string;
  unit: string;
  unitCost: number;
  currency: string;
  minimumStock: number;
  supplier?: string;
  workspaceId: string;
}

export interface UpdateIngredientInput {
  name?: string;
  code?: string;
  description?: string;
  unit?: string;
  unitCost?: number;
  currency?: string;
  minimumStock?: number;
  supplier?: string;
  isActive?: boolean;
}

/**
 * Service de gestion des ingrédients / matières premières
 */
export class IngredientService {
  /**
   * Liste tous les ingrédients
   */
  async list(
    workspaceId: string,
    filters?: {
      isActive?: boolean;
      belowMinimum?: boolean;
    }
  ): Promise<Ingredient[]> {
    const conditions: string[] = [`workspace_id = '${workspaceId}'`];

    if (filters?.isActive !== undefined) {
      conditions.push(`is_active = ${filters.isActive}`);
    }

    const ingredients = await postgresClient.list<Ingredient>('ingredients', {
      filterByFormula: conditions.join(' AND '),
      orderBy: { field: 'name', direction: 'asc' },
    });

    // Filtre côté client pour les ingrédients sous le minimum
    if (filters?.belowMinimum) {
      return ingredients.filter((ing) => ing.CurrentStock < ing.MinimumStock);
    }

    return ingredients;
  }

  /**
   * Récupère un ingrédient par ID
   */
  async getById(ingredientId: string): Promise<Ingredient | null> {
    const results = await postgresClient.list<Ingredient>('ingredients', {
      filterByFormula: `ingredient_id = '${ingredientId}'`,
    });
    return results[0] || null;
  }

  /**
   * Récupère un ingrédient par code
   */
  async getByCode(workspaceId: string, code: string): Promise<Ingredient | null> {
    const results = await postgresClient.list<Ingredient>('ingredients', {
      filterByFormula: `workspace_id = '${workspaceId}' AND code = '${code}'`,
    });
    return results[0] || null;
  }

  /**
   * Crée un nouvel ingrédient
   */
  async create(input: CreateIngredientInput): Promise<Ingredient> {
    // Vérifier si le code existe déjà
    const existingIngredient = await this.getByCode(input.workspaceId, input.code);
    if (existingIngredient) {
      throw new Error('Un ingrédient avec ce code existe déjà');
    }

    const ingredient: Partial<Ingredient> = {
      IngredientId: uuidv4(),
      Name: input.name,
      Code: input.code,
      Description: input.description,
      Unit: input.unit,
      UnitCost: input.unitCost,
      Currency: input.currency,
      MinimumStock: input.minimumStock,
      CurrentStock: 0, // Initialisé à 0
      Supplier: input.supplier,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Ingredient>('ingredients', ingredient);
    return created;
  }

  /**
   * Met à jour un ingrédient
   */
  async update(ingredientId: string, updates: UpdateIngredientInput): Promise<Ingredient> {
    const ingredient = await this.getById(ingredientId);
    if (!ingredient) {
      throw new Error('Ingrédient non trouvé');
    }

    // Vérifier le code si modifié
    if (updates.code && updates.code !== ingredient.Code) {
      const existingIngredient = await this.getByCode(ingredient.WorkspaceId, updates.code);
      if (existingIngredient) {
        throw new Error('Un ingrédient avec ce code existe déjà');
      }
    }

    const records = await postgresClient.list<Ingredient>('ingredients', {
      filterByFormula: `ingredient_id = '${ingredientId}'`,
    });

    if (records.length === 0) {
      throw new Error('Ingrédient non trouvé');
    }

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('ID d\'enregistrement non trouvé');
    }

    const updateData: Record<string, any> = {
      UpdatedAt: new Date().toISOString(),
    };
    if (updates.name !== undefined) updateData.Name = updates.name;
    if (updates.code !== undefined) updateData.Code = updates.code;
    if (updates.description !== undefined) updateData.Description = updates.description;
    if (updates.unit !== undefined) updateData.Unit = updates.unit;
    if (updates.unitCost !== undefined) updateData.UnitCost = updates.unitCost;
    if (updates.currency !== undefined) updateData.Currency = updates.currency;
    if (updates.minimumStock !== undefined) updateData.MinimumStock = updates.minimumStock;
    if (updates.supplier !== undefined) updateData.Supplier = updates.supplier;
    if (updates.isActive !== undefined) updateData.IsActive = updates.isActive;

    const updated = await postgresClient.update<Ingredient>('ingredients', recordId, updateData);
    return updated;
  }

  /**
   * Augmente le stock d'un ingrédient (après achat/réception)
   */
  async increaseStock(
    ingredientId: string,
    quantity: number,
    unitCost?: number
  ): Promise<Ingredient> {
    const ingredient = await this.getById(ingredientId);
    if (!ingredient) {
      throw new Error('Ingrédient non trouvé');
    }

    if (quantity <= 0) {
      throw new Error('La quantité doit être positive');
    }

    const newStock = ingredient.CurrentStock + quantity;
    const newUnitCost = unitCost !== undefined ? unitCost : ingredient.UnitCost;

    const records = await postgresClient.list<Ingredient>('ingredients', {
      filterByFormula: `ingredient_id = '${ingredientId}'`,
    });

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('ID d\'enregistrement non trouvé');
    }

    const updated = await postgresClient.update<Ingredient>('ingredients', recordId, {
      CurrentStock: newStock,
      UnitCost: newUnitCost,
      UpdatedAt: new Date().toISOString(),
    });
    return updated;
  }

  /**
   * Diminue le stock d'un ingrédient (consommation en production)
   */
  async decreaseStock(ingredientId: string, quantity: number): Promise<Ingredient> {
    const ingredient = await this.getById(ingredientId);
    if (!ingredient) {
      throw new Error('Ingrédient non trouvé');
    }

    if (quantity <= 0) {
      throw new Error('La quantité doit être positive');
    }

    if (ingredient.CurrentStock < quantity) {
      throw new Error(
        `Stock insuffisant: ${ingredient.CurrentStock} ${ingredient.Unit} disponible(s), ${quantity} ${ingredient.Unit} demandé(s)`
      );
    }

    const newStock = ingredient.CurrentStock - quantity;

    const records = await postgresClient.list<Ingredient>('ingredients', {
      filterByFormula: `ingredient_id = '${ingredientId}'`,
    });

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('ID d\'enregistrement non trouvé');
    }

    const updated = await postgresClient.update<Ingredient>('ingredients', recordId, {
      CurrentStock: newStock,
      UpdatedAt: new Date().toISOString(),
    });
    return updated;
  }

  /**
   * Désactive un ingrédient
   */
  async deactivate(ingredientId: string): Promise<Ingredient> {
    return await this.update(ingredientId, { isActive: false });
  }

  /**
   * Active un ingrédient
   */
  async activate(ingredientId: string): Promise<Ingredient> {
    return await this.update(ingredientId, { isActive: true });
  }

  /**
   * Récupère les ingrédients sous le seuil minimum (alertes)
   */
  async getBelowMinimum(workspaceId: string): Promise<Ingredient[]> {
    return await this.list(workspaceId, { isActive: true, belowMinimum: true });
  }

  /**
   * Statistiques des ingrédients
   */
  async getStatistics(workspaceId: string): Promise<{
    totalIngredients: number;
    activeIngredients: number;
    inactiveIngredients: number;
    belowMinimum: number;
    totalValue: number;
  }> {
    const ingredients = await this.list(workspaceId);
    const activeIngredients = ingredients.filter((i) => i.IsActive);
    const belowMinimum = activeIngredients.filter((i) => i.CurrentStock < i.MinimumStock);
    const totalValue = ingredients.reduce((sum, i) => sum + i.CurrentStock * i.UnitCost, 0);

    return {
      totalIngredients: ingredients.length,
      activeIngredients: activeIngredients.length,
      inactiveIngredients: ingredients.filter((i) => !i.IsActive).length,
      belowMinimum: belowMinimum.length,
      totalValue,
    };
  }
}
