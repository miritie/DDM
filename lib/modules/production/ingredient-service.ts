/**
 * Service - Gestion des Ingrédients / Matières Premières
 * Module Production & Usine
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Ingredient } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.isActive !== undefined) {
      formula += `, {IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`;
    }

    const ingredients = await airtableClient.list<Ingredient>('Ingredient', {
      filterByFormula: `AND(${formula})`,
      sort: [{ field: 'Name', direction: 'asc' }],
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
    const results = await airtableClient.list<Ingredient>('Ingredient', {
      filterByFormula: `{IngredientId} = '${ingredientId}'`,
    });
    return results[0] || null;
  }

  /**
   * Récupère un ingrédient par code
   */
  async getByCode(workspaceId: string, code: string): Promise<Ingredient | null> {
    const results = await airtableClient.list<Ingredient>('Ingredient', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Code} = '${code}')`,
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

    const created = await airtableClient.create<Ingredient>('Ingredient', ingredient);
    if (!created) {
      throw new Error('Failed to create ingredient - Airtable not configured');
    }
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

    const records = await airtableClient.list<Ingredient>('Ingredient', {
      filterByFormula: `{IngredientId} = '${ingredientId}'`,
    });

    if (records.length === 0) {
      throw new Error('Ingrédient non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    const updated = await airtableClient.update<Ingredient>('Ingredient', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update ingredient - Airtable not configured');
    }
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

    const records = await airtableClient.list<Ingredient>('Ingredient', {
      filterByFormula: `{IngredientId} = '${ingredientId}'`,
    });

    const recordId = (records[0] as any)._recordId;

    const updated = await airtableClient.update<Ingredient>('Ingredient', recordId, {
      CurrentStock: newStock,
      UnitCost: newUnitCost,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update ingredient - Airtable not configured');
    }
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

    const records = await airtableClient.list<Ingredient>('Ingredient', {
      filterByFormula: `{IngredientId} = '${ingredientId}'`,
    });

    const recordId = (records[0] as any)._recordId;

    const updated = await airtableClient.update<Ingredient>('Ingredient', recordId, {
      CurrentStock: newStock,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update ingredient - Airtable not configured');
    }
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
