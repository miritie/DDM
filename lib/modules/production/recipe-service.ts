/**
 * Service - Gestion des Recettes / BOM (Bill of Materials)
 * Module Production & Usine
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Recipe, RecipeLine } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateRecipeInput {
  name: string;
  productId: string;
  productName?: string;
  outputQuantity: number;
  outputUnit: string;
  estimatedDuration: number;
  instructions?: string;
  yieldRate: number;
  lines: CreateRecipeLineInput[];
  workspaceId: string;
}

export interface CreateRecipeLineInput {
  ingredientId: string;
  ingredientName?: string;
  quantity: number;
  unit: string;
  loss?: number;
  notes?: string;
}

export interface UpdateRecipeInput {
  name?: string;
  productId?: string;
  productName?: string;
  outputQuantity?: number;
  outputUnit?: string;
  estimatedDuration?: number;
  instructions?: string;
  yieldRate?: number;
  isActive?: boolean;
}

/**
 * Service de gestion des recettes / BOM
 */
export class RecipeService {
  /**
   * Liste toutes les recettes
   */
  async list(
    workspaceId: string,
    filters?: {
      isActive?: boolean;
      productId?: string;
    }
  ): Promise<Recipe[]> {
    let formulaParts = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters?.isActive !== undefined) {
      formulaParts.push(`{IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`);
    }

    if (filters?.productId) {
      formulaParts.push(`{ProductId} = '${filters.productId}'`);
    }

    const recipes = await airtableClient.list<Recipe>('Recipe', {
      filterByFormula: `AND(${formulaParts.join(', ')})`,
      sort: [{ field: 'RecipeNumber', direction: 'desc' }],
    });

    // Charger les lignes pour chaque recette
    for (const recipe of recipes) {
      recipe.Lines = await this.getRecipeLines(recipe.RecipeId);
    }

    return recipes;
  }

  /**
   * Récupère une recette par ID
   */
  async getById(recipeId: string): Promise<Recipe | null> {
    const results = await airtableClient.list<Recipe>('Recipe', {
      filterByFormula: `{RecipeId} = '${recipeId}'`,
    });

    if (results.length === 0) {
      return null;
    }

    const recipe = results[0];
    recipe.Lines = await this.getRecipeLines(recipeId);

    return recipe;
  }

  /**
   * Récupère une recette par numéro
   */
  async getByNumber(workspaceId: string, recipeNumber: string): Promise<Recipe | null> {
    const results = await airtableClient.list<Recipe>('Recipe', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {RecipeNumber} = '${recipeNumber}')`,
    });

    if (results.length === 0) {
      return null;
    }

    const recipe = results[0];
    recipe.Lines = await this.getRecipeLines(recipe.RecipeId);

    return recipe;
  }

  /**
   * Récupère les lignes d'une recette
   */
  async getRecipeLines(recipeId: string): Promise<RecipeLine[]> {
    return await airtableClient.list<RecipeLine>('RecipeLine', {
      filterByFormula: `{RecipeId} = '${recipeId}'`,
      sort: [{ field: 'CreatedAt', direction: 'asc' }],
    });
  }

  /**
   * Génère le prochain numéro de recette
   */
  private async generateRecipeNumber(workspaceId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `REC-${year}${month}`;

    const existingRecipes = await airtableClient.list<Recipe>('Recipe', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', SEARCH('${prefix}', {RecipeNumber}) = 1)`,
      sort: [{ field: 'RecipeNumber', direction: 'desc' }],
    });

    let nextNumber = 1;
    if (existingRecipes.length > 0) {
      const lastNumber = existingRecipes[0].RecipeNumber;
      const match = lastNumber.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Crée une nouvelle recette avec ses lignes
   */
  async create(input: CreateRecipeInput): Promise<Recipe> {
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Une recette doit contenir au moins un ingrédient');
    }

    const recipeNumber = await this.generateRecipeNumber(input.workspaceId);
    const recipeId = uuidv4();

    // Créer la recette
    const recipe: Partial<Recipe> = {
      RecipeId: recipeId,
      RecipeNumber: recipeNumber,
      Name: input.name,
      ProductId: input.productId,
      ProductName: input.productName,
      Version: 1,
      OutputQuantity: input.outputQuantity,
      OutputUnit: input.outputUnit,
      EstimatedDuration: input.estimatedDuration,
      Instructions: input.instructions,
      YieldRate: input.yieldRate,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdRecipe = await airtableClient.create<Recipe>('Recipe', recipe);

    // Créer les lignes de la recette
    const lines: RecipeLine[] = [];
    for (const lineInput of input.lines) {
      const line: Partial<RecipeLine> = {
        RecipeLineId: uuidv4(),
        RecipeId: recipeId,
        IngredientId: lineInput.ingredientId,
        IngredientName: lineInput.ingredientName,
        Quantity: lineInput.quantity,
        Unit: lineInput.unit,
        Loss: lineInput.loss,
        Notes: lineInput.notes,
      };

      const createdLine = await airtableClient.create<RecipeLine>('RecipeLine', line);
      lines.push(createdLine);
    }

    createdRecipe.Lines = lines;
    return createdRecipe;
  }

  /**
   * Met à jour une recette (crée une nouvelle version)
   */
  async update(recipeId: string, updates: UpdateRecipeInput): Promise<Recipe> {
    const recipe = await this.getById(recipeId);
    if (!recipe) {
      throw new Error('Recette non trouvée');
    }

    const records = await airtableClient.list<Recipe>('Recipe', {
      filterByFormula: `{RecipeId} = '${recipeId}'`,
    });

    if (records.length === 0) {
      throw new Error('Recette non trouvée');
    }

    const recordId = (records[0] as any)._recordId;

    const updatedRecipe = await airtableClient.update<Recipe>('Recipe', recordId, {
      ...updates,
      Version: recipe.Version + 1,
      UpdatedAt: new Date().toISOString(),
    });

    updatedRecipe.Lines = await this.getRecipeLines(recipeId);
    return updatedRecipe;
  }

  /**
   * Ajoute une ligne à une recette
   */
  async addLine(recipeId: string, lineInput: CreateRecipeLineInput): Promise<RecipeLine> {
    const recipe = await this.getById(recipeId);
    if (!recipe) {
      throw new Error('Recette non trouvée');
    }

    const line: Partial<RecipeLine> = {
      RecipeLineId: uuidv4(),
      RecipeId: recipeId,
      IngredientId: lineInput.ingredientId,
      IngredientName: lineInput.ingredientName,
      Quantity: lineInput.quantity,
      Unit: lineInput.unit,
      Loss: lineInput.loss,
      Notes: lineInput.notes,
    };

    return await airtableClient.create<RecipeLine>('RecipeLine', line);
  }

  /**
   * Met à jour une ligne de recette
   */
  async updateLine(
    recipeLineId: string,
    updates: {
      quantity?: number;
      unit?: string;
      loss?: number;
      notes?: string;
    }
  ): Promise<RecipeLine> {
    const records = await airtableClient.list<RecipeLine>('RecipeLine', {
      filterByFormula: `{RecipeLineId} = '${recipeLineId}'`,
    });

    if (records.length === 0) {
      throw new Error('Ligne de recette non trouvée');
    }

    const recordId = (records[0] as any)._recordId;

    return await airtableClient.update<RecipeLine>('RecipeLine', recordId, updates);
  }

  /**
   * Supprime une ligne de recette
   */
  async deleteLine(recipeLineId: string): Promise<void> {
    const records = await airtableClient.list<RecipeLine>('RecipeLine', {
      filterByFormula: `{RecipeLineId} = '${recipeLineId}'`,
    });

    if (records.length === 0) {
      throw new Error('Ligne de recette non trouvée');
    }

    const recordId = (records[0] as any)._recordId;
    await airtableClient.delete('RecipeLine', recordId);
  }

  /**
   * Duplique une recette (nouvelle version)
   */
  async duplicate(recipeId: string, newName?: string): Promise<Recipe> {
    const originalRecipe = await this.getById(recipeId);
    if (!originalRecipe) {
      throw new Error('Recette non trouvée');
    }

    const duplicateInput: CreateRecipeInput = {
      name: newName || `${originalRecipe.Name} (Copie)`,
      productId: originalRecipe.ProductId,
      productName: originalRecipe.ProductName,
      outputQuantity: originalRecipe.OutputQuantity,
      outputUnit: originalRecipe.OutputUnit,
      estimatedDuration: originalRecipe.EstimatedDuration,
      instructions: originalRecipe.Instructions,
      yieldRate: originalRecipe.YieldRate,
      lines: originalRecipe.Lines.map((line) => ({
        ingredientId: line.IngredientId,
        ingredientName: line.IngredientName,
        quantity: line.Quantity,
        unit: line.Unit,
        loss: line.Loss,
        notes: line.Notes,
      })),
      workspaceId: originalRecipe.WorkspaceId,
    };

    return await this.create(duplicateInput);
  }

  /**
   * Désactive une recette
   */
  async deactivate(recipeId: string): Promise<Recipe> {
    return await this.update(recipeId, { isActive: false });
  }

  /**
   * Active une recette
   */
  async activate(recipeId: string): Promise<Recipe> {
    return await this.update(recipeId, { isActive: true });
  }

  /**
   * Calcule le coût total d'une recette
   */
  async calculateCost(recipeId: string): Promise<{
    totalCost: number;
    costPerUnit: number;
    ingredientCosts: Array<{
      ingredientId: string;
      ingredientName: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
    }>;
  }> {
    const recipe = await this.getById(recipeId);
    if (!recipe) {
      throw new Error('Recette non trouvée');
    }

    const ingredientCosts = [];
    let totalCost = 0;

    for (const line of recipe.Lines) {
      // Récupérer le coût unitaire de l'ingrédient
      const ingredients = await airtableClient.list('Ingredient', {
        filterByFormula: `{IngredientId} = '${line.IngredientId}'`,
      });

      if (ingredients.length > 0) {
        const ingredient = ingredients[0] as any;
        const lineCost = line.Quantity * ingredient.UnitCost;
        totalCost += lineCost;

        ingredientCosts.push({
          ingredientId: line.IngredientId,
          ingredientName: line.IngredientName || ingredient.Name,
          quantity: line.Quantity,
          unitCost: ingredient.UnitCost,
          totalCost: lineCost,
        });
      }
    }

    const costPerUnit = totalCost / recipe.OutputQuantity;

    return {
      totalCost,
      costPerUnit,
      ingredientCosts,
    };
  }

  /**
   * Statistiques des recettes
   */
  async getStatistics(workspaceId: string): Promise<{
    totalRecipes: number;
    activeRecipes: number;
    inactiveRecipes: number;
    averageDuration: number;
    averageYieldRate: number;
  }> {
    const recipes = await this.list(workspaceId);
    const activeRecipes = recipes.filter((r) => r.IsActive);
    const totalDuration = recipes.reduce((sum, r) => sum + r.EstimatedDuration, 0);
    const totalYield = recipes.reduce((sum, r) => sum + r.YieldRate, 0);

    return {
      totalRecipes: recipes.length,
      activeRecipes: activeRecipes.length,
      inactiveRecipes: recipes.filter((r) => !r.IsActive).length,
      averageDuration: recipes.length > 0 ? totalDuration / recipes.length : 0,
      averageYieldRate: recipes.length > 0 ? totalYield / recipes.length : 0,
    };
  }
}
