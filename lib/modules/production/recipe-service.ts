/**
 * Service - Gestion des Recettes / BOM (Bill of Materials)
 * Module Production & Usine
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Recipe, RecipeLine } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

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
    const conditions: string[] = [`workspace_id = '${workspaceId}'`];

    if (filters?.isActive !== undefined) {
      conditions.push(`is_active = ${filters.isActive}`);
    }

    if (filters?.productId) {
      conditions.push(`product_id = '${filters.productId}'`);
    }

    const recipes = await postgresClient.list<Recipe>('recipes', {
      filterByFormula: conditions.join(' AND '),
      orderBy: { field: 'recipe_number', direction: 'desc' },
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
    const results = await postgresClient.list<Recipe>('recipes', {
      filterByFormula: `recipe_id = '${recipeId}'`,
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
    const results = await postgresClient.list<Recipe>('recipes', {
      filterByFormula: `workspace_id = '${workspaceId}' AND recipe_number = '${recipeNumber}'`,
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
    return await postgresClient.list<RecipeLine>('recipe_lines', {
      filterByFormula: `recipe_id = '${recipeId}'`,
      orderBy: { field: 'created_at', direction: 'asc' },
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

    const existingRecipes = await postgresClient.list<Recipe>('recipes', {
      filterByFormula: `workspace_id = '${workspaceId}' AND recipe_number LIKE '${prefix}%'`,
      orderBy: { field: 'recipe_number', direction: 'desc' },
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

    const createdRecipe = await postgresClient.create<Recipe>('recipes', recipe);

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

      const createdLine = await postgresClient.create<RecipeLine>('recipe_lines', line);
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

    const records = await postgresClient.list<Recipe>('recipes', {
      filterByFormula: `recipe_id = '${recipeId}'`,
    });

    if (records.length === 0) {
      throw new Error('Recette non trouvée');
    }

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('ID d\'enregistrement non trouvé');
    }

    const updateData: Record<string, any> = {
      Version: recipe.Version + 1,
      UpdatedAt: new Date().toISOString(),
    };
    if (updates.name !== undefined) updateData.Name = updates.name;
    if (updates.productId !== undefined) updateData.ProductId = updates.productId;
    if (updates.productName !== undefined) updateData.ProductName = updates.productName;
    if (updates.outputQuantity !== undefined) updateData.OutputQuantity = updates.outputQuantity;
    if (updates.outputUnit !== undefined) updateData.OutputUnit = updates.outputUnit;
    if (updates.estimatedDuration !== undefined) updateData.EstimatedDuration = updates.estimatedDuration;
    if (updates.instructions !== undefined) updateData.Instructions = updates.instructions;
    if (updates.yieldRate !== undefined) updateData.YieldRate = updates.yieldRate;
    if (updates.isActive !== undefined) updateData.IsActive = updates.isActive;

    const updatedRecipe = await postgresClient.update<Recipe>('recipes', recordId, updateData);

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

    const created = await postgresClient.create<RecipeLine>('recipe_lines', line);
    return created;
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
    const records = await postgresClient.list<RecipeLine>('recipe_lines', {
      filterByFormula: `recipe_line_id = '${recipeLineId}'`,
    });

    if (records.length === 0) {
      throw new Error('Ligne de recette non trouvée');
    }

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('ID d\'enregistrement non trouvé');
    }

    const data: Record<string, any> = {};
    if (updates.quantity !== undefined) data.Quantity = updates.quantity;
    if (updates.unit !== undefined) data.Unit = updates.unit;
    if (updates.loss !== undefined) data.Loss = updates.loss;
    if (updates.notes !== undefined) data.Notes = updates.notes;

    const updated = await postgresClient.update<RecipeLine>('recipe_lines', recordId, data);
    return updated;
  }

  /**
   * Supprime une ligne de recette
   */
  async deleteLine(recipeLineId: string): Promise<void> {
    const records = await postgresClient.list<RecipeLine>('recipe_lines', {
      filterByFormula: `recipe_line_id = '${recipeLineId}'`,
    });

    if (records.length === 0) {
      throw new Error('Ligne de recette non trouvée');
    }

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('ID d\'enregistrement non trouvé');
    }
    await postgresClient.delete('recipe_lines', recordId);
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
      const ingredients = await postgresClient.list('ingredients', {
        filterByFormula: `ingredient_id = '${line.IngredientId}'`,
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
