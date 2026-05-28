/**
 * Service - Recettes / Bill of Materials (BOM)
 *
 * Mise à jour 2026-05-14 :
 *   - réécriture en SQL direct via pool.query() (plus de filterByFormula).
 *   - versioning : update() incrémente recipes.version.
 *   - calculateCost() prend le PMP courant des ingrédients (jointure live).
 *
 * Convention de retour : PascalCase via alias SQL pour compat UI existante.
 */
import { getPostgresClient } from '@/lib/database/postgres-client';
import { Recipe, RecipeLine } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { assertPositiveFinishedProductQuantity } from '@/lib/schemas/quantity';

const db = getPostgresClient();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_RECIPE = `
  SELECT
    r.id,
    r.recipe_id        AS "RecipeId",
    r.recipe_number    AS "RecipeNumber",
    r.name             AS "Name",
    r.product_id       AS "ProductId",
    r.product_name     AS "ProductName",
    r.version          AS "Version",
    r.output_quantity  AS "OutputQuantity",
    r.output_unit      AS "OutputUnit",
    r.estimated_duration AS "EstimatedDuration",
    r.instructions     AS "Instructions",
    r.yield_rate       AS "YieldRate",
    r.is_active        AS "IsActive",
    r.workspace_id     AS "WorkspaceId",
    r.created_at       AS "CreatedAt",
    r.updated_at       AS "UpdatedAt"
  FROM recipes r
`;

const SELECT_RECIPE_LINE = `
  SELECT
    id,
    recipe_line_id   AS "RecipeLineId",
    recipe_id        AS "RecipeId",
    ingredient_id    AS "IngredientId",
    ingredient_name  AS "IngredientName",
    quantity         AS "Quantity",
    unit             AS "Unit",
    loss             AS "Loss",
    notes            AS "Notes",
    created_at       AS "CreatedAt"
  FROM recipe_lines
`;

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

export interface CreateRecipeInput {
  name: string;
  productId: string;
  productName?: string;
  outputQuantity: number;
  outputUnit: string;
  estimatedDuration?: number;
  instructions?: string;
  yieldRate?: number;
  lines: CreateRecipeLineInput[];
  workspaceId: string;
}

export interface CreateRecipeLineInput {
  ingredientId: string;
  quantity: number;
  unit?: string;
  loss?: number;
  notes?: string;
}

export interface UpdateRecipeInput {
  name?: string;
  productId?: string;
  outputQuantity?: number;
  outputUnit?: string;
  estimatedDuration?: number;
  instructions?: string;
  yieldRate?: number;
  isActive?: boolean;
}

export class RecipeService {

  async list(workspaceId: string, filters?: {
    isActive?: boolean;
    productId?: string;
  }): Promise<Recipe[]> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) return [];

    const conds: string[] = ['r.workspace_id = $1'];
    const params: any[] = [wsUuid];

    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      conds.push(`r.is_active = $${params.length}`);
    }
    if (filters?.productId) {
      const pUuid = await resolveUuid('products', 'product_id', filters.productId);
      if (pUuid) {
        params.push(pUuid);
        conds.push(`r.product_id = $${params.length}`);
      }
    }

    const r = await db.query(
      `${SELECT_RECIPE} WHERE ${conds.join(' AND ')} ORDER BY r.recipe_number DESC`,
      params
    );
    const recipes: Recipe[] = r.rows;
    for (const recipe of recipes) {
      recipe.Lines = await this.getRecipeLines(recipe.id!);
    }
    return recipes;
  }

  async getById(idOrSlug: string): Promise<Recipe | null> {
    const r = await db.query(
      `${SELECT_RECIPE} WHERE r.id::text = $1 OR r.recipe_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    const recipe = r.rows[0];
    if (!recipe) return null;
    recipe.Lines = await this.getRecipeLines(recipe.id);
    return recipe;
  }

  async getRecipeLines(recipeUuid: string): Promise<RecipeLine[]> {
    const r = await db.query(
      `${SELECT_RECIPE_LINE} WHERE recipe_id = $1 ORDER BY created_at ASC`,
      [recipeUuid]
    );
    return r.rows;
  }

  private async generateRecipeNumber(workspaceUuid: string): Promise<string> {
    const now = new Date();
    const prefix = `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const r = await db.query(
      `SELECT recipe_number FROM recipes
       WHERE workspace_id = $1 AND recipe_number LIKE $2
       ORDER BY recipe_number DESC LIMIT 1`,
      [workspaceUuid, `${prefix}%`]
    );
    let next = 1;
    if (r.rows[0]) {
      const m = r.rows[0].recipe_number.match(/-(\d+)$/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  async create(input: CreateRecipeInput): Promise<Recipe> {
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Une recette doit contenir au moins un ingrédient');
    }
    assertPositiveFinishedProductQuantity(input.outputQuantity, 'Quantité produite par lot');

    const wsUuid = await resolveUuid('workspaces', 'workspace_id', input.workspaceId);
    if (!wsUuid) throw new Error('Workspace introuvable');

    const productUuid = await resolveUuid('products', 'product_id', input.productId);
    if (!productUuid) throw new Error('Produit introuvable');

    const recipeId = `REC-${uuidv4().slice(0, 8)}`;
    const recipeNumber = await this.generateRecipeNumber(wsUuid);

    const createdRecipe = await db.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO recipes (
           recipe_id, recipe_number, name, product_id, product_name,
           version, output_quantity, output_unit, estimated_duration,
           instructions, yield_rate, is_active, workspace_id
         ) VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10,true,$11)
         RETURNING id`,
        [
          recipeId, recipeNumber, input.name, productUuid, input.productName ?? null,
          input.outputQuantity, input.outputUnit, input.estimatedDuration ?? null,
          input.instructions ?? null, input.yieldRate ?? 100, wsUuid,
        ]
      );
      const recipeUuid = ins.rows[0].id;

      for (const line of input.lines) {
        const ingUuid = await resolveUuid('ingredients', 'ingredient_id', line.ingredientId);
        if (!ingUuid) throw new Error(`Ingrédient introuvable : ${line.ingredientId}`);
        const ingMeta = await client.query(
          `SELECT name, unit FROM ingredients WHERE id = $1`,
          [ingUuid]
        );
        const ingName = ingMeta.rows[0]?.name;
        const ingUnit = line.unit ?? ingMeta.rows[0]?.unit ?? 'unit';

        await client.query(
          `INSERT INTO recipe_lines (
             recipe_line_id, recipe_id, ingredient_id, ingredient_name,
             quantity, unit, loss, notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            `RL-${uuidv4().slice(0, 8)}`, recipeUuid, ingUuid, ingName,
            line.quantity, ingUnit, line.loss ?? 0, line.notes ?? null,
          ]
        );
      }
      return recipeUuid;
    });

    return (await this.getById(createdRecipe))!;
  }

  /**
   * Met à jour la recette ET incrémente version. Les OP en cours qui ont snapshot
   * recipe_version restent figés sur l'ancienne version.
   */
  async update(idOrSlug: string, updates: UpdateRecipeInput): Promise<Recipe> {
    const recipe = await this.getById(idOrSlug);
    if (!recipe) throw new Error('Recette introuvable');

    const sets: string[] = ['version = version + 1'];
    const params: any[] = [];
    const push = (col: string, v: any) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (updates.name !== undefined) push('name', updates.name);
    if (updates.productId !== undefined) {
      const pUuid = await resolveUuid('products', 'product_id', updates.productId);
      push('product_id', pUuid);
    }
    if (updates.outputQuantity !== undefined) push('output_quantity', updates.outputQuantity);
    if (updates.outputUnit !== undefined) push('output_unit', updates.outputUnit);
    if (updates.estimatedDuration !== undefined) push('estimated_duration', updates.estimatedDuration);
    if (updates.instructions !== undefined) push('instructions', updates.instructions);
    if (updates.yieldRate !== undefined) push('yield_rate', updates.yieldRate);
    if (updates.isActive !== undefined) push('is_active', updates.isActive);

    params.push(recipe.id);
    await db.query(`UPDATE recipes SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    return (await this.getById(recipe.id!))!;
  }

  async addLine(recipeIdOrSlug: string, line: CreateRecipeLineInput): Promise<RecipeLine> {
    const recipe = await this.getById(recipeIdOrSlug);
    if (!recipe) throw new Error('Recette introuvable');

    const ingUuid = await resolveUuid('ingredients', 'ingredient_id', line.ingredientId);
    if (!ingUuid) throw new Error('Ingrédient introuvable');

    const meta = await db.query(`SELECT name, unit FROM ingredients WHERE id = $1`, [ingUuid]);
    const lineUuid = uuidv4();
    const lineSlug = `RL-${lineUuid.slice(0, 8)}`;

    await db.query(
      `INSERT INTO recipe_lines (
         recipe_line_id, recipe_id, ingredient_id, ingredient_name,
         quantity, unit, loss, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        lineSlug, recipe.id, ingUuid, meta.rows[0]?.name ?? null,
        line.quantity, line.unit ?? meta.rows[0]?.unit ?? 'unit', line.loss ?? 0, line.notes ?? null,
      ]
    );

    // Bump version
    await db.query(`UPDATE recipes SET version = version + 1 WHERE id = $1`, [recipe.id]);

    const r = await db.query(`${SELECT_RECIPE_LINE} WHERE recipe_line_id = $1`, [lineSlug]);
    return r.rows[0];
  }

  async updateLine(lineIdOrSlug: string, updates: {
    quantity?: number; unit?: string; loss?: number; notes?: string;
  }): Promise<RecipeLine> {
    const sets: string[] = [];
    const params: any[] = [];
    const push = (col: string, v: any) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (updates.quantity !== undefined) push('quantity', updates.quantity);
    if (updates.unit !== undefined) push('unit', updates.unit);
    if (updates.loss !== undefined) push('loss', updates.loss);
    if (updates.notes !== undefined) push('notes', updates.notes);

    if (sets.length === 0) throw new Error('Aucune modification fournie');

    params.push(lineIdOrSlug);
    const where = `id::text = $${params.length} OR recipe_line_id = $${params.length}`;
    const r = await db.query(
      `UPDATE recipe_lines SET ${sets.join(', ')} WHERE ${where} RETURNING recipe_id`,
      params
    );
    if (r.rowCount === 0) throw new Error('Ligne de recette introuvable');

    await db.query(`UPDATE recipes SET version = version + 1 WHERE id = $1`, [r.rows[0].recipe_id]);

    const out = await db.query(
      `${SELECT_RECIPE_LINE} WHERE id::text = $1 OR recipe_line_id = $1 LIMIT 1`,
      [lineIdOrSlug]
    );
    return out.rows[0];
  }

  async deleteLine(lineIdOrSlug: string): Promise<void> {
    const r = await db.query(
      `DELETE FROM recipe_lines WHERE id::text = $1 OR recipe_line_id = $1 RETURNING recipe_id`,
      [lineIdOrSlug]
    );
    if (r.rowCount === 0) throw new Error('Ligne de recette introuvable');
    await db.query(`UPDATE recipes SET version = version + 1 WHERE id = $1`, [r.rows[0].recipe_id]);
  }

  async duplicate(recipeIdOrSlug: string, newName?: string): Promise<Recipe> {
    const original = await this.getById(recipeIdOrSlug);
    if (!original) throw new Error('Recette introuvable');

    return this.create({
      name: newName ?? `${original.Name} (Copie)`,
      productId: original.ProductId,
      productName: original.ProductName,
      outputQuantity: Number(original.OutputQuantity),
      outputUnit: original.OutputUnit,
      estimatedDuration: original.EstimatedDuration,
      instructions: original.Instructions,
      yieldRate: Number(original.YieldRate),
      lines: original.Lines.map((l) => ({
        ingredientId: l.IngredientId,
        quantity: Number(l.Quantity),
        unit: l.Unit,
        loss: l.Loss ? Number(l.Loss) : 0,
        notes: l.Notes,
      })),
      workspaceId: original.WorkspaceId,
    });
  }

  async deactivate(idOrSlug: string): Promise<Recipe> {
    return this.update(idOrSlug, { isActive: false });
  }

  async activate(idOrSlug: string): Promise<Recipe> {
    return this.update(idOrSlug, { isActive: true });
  }

  /**
   * Calcule le coût total de la recette en utilisant le PMP courant
   * des ingrédients (jointure live, pas un snapshot).
   */
  async calculateCost(recipeIdOrSlug: string): Promise<{
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
    const recipe = await this.getById(recipeIdOrSlug);
    if (!recipe) throw new Error('Recette introuvable');

    const r = await db.query(
      `SELECT
         rl.ingredient_id  AS ingredient_uuid,
         i.ingredient_id   AS ingredient_slug,
         COALESCE(rl.ingredient_name, i.name) AS ingredient_name,
         rl.quantity::numeric AS quantity,
         i.unit_cost::numeric AS unit_cost
       FROM recipe_lines rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       WHERE rl.recipe_id = $1`,
      [recipe.id]
    );

    let totalCost = 0;
    const ingredientCosts = r.rows.map((row) => {
      const qty = Number(row.quantity);
      const uc = Number(row.unit_cost);
      const tc = qty * uc;
      totalCost += tc;
      return {
        ingredientId: row.ingredient_slug,
        ingredientName: row.ingredient_name,
        quantity: qty,
        unitCost: uc,
        totalCost: tc,
      };
    });

    const costPerUnit = Number(recipe.OutputQuantity) > 0
      ? totalCost / Number(recipe.OutputQuantity)
      : 0;

    return { totalCost, costPerUnit, ingredientCosts };
  }

  async getStatistics(workspaceId: string): Promise<{
    totalRecipes: number;
    activeRecipes: number;
    inactiveRecipes: number;
    averageDuration: number;
    averageYieldRate: number;
    avgYieldRate: number;        // alias compat
    totalIngredients: number;    // nb d'ingrédients distincts utilisés
  }> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) {
      return { totalRecipes: 0, activeRecipes: 0, inactiveRecipes: 0,
               averageDuration: 0, averageYieldRate: 0, avgYieldRate: 0, totalIngredients: 0 };
    }
    const r = await db.query(
      `SELECT
         COUNT(*)::int                                   AS total,
         SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS active,
         SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END)::int AS inactive,
         COALESCE(AVG(estimated_duration), 0)::numeric   AS avg_dur,
         COALESCE(AVG(yield_rate), 0)::numeric           AS avg_yield
       FROM recipes WHERE workspace_id = $1`,
      [wsUuid]
    );
    const ing = await db.query(
      `SELECT COUNT(DISTINCT rl.ingredient_id)::int AS n
         FROM recipe_lines rl
         JOIN recipes r ON r.id = rl.recipe_id
        WHERE r.workspace_id = $1`,
      [wsUuid]
    );
    const row = r.rows[0];
    const avgY = Number(row.avg_yield);
    return {
      totalRecipes: row.total,
      activeRecipes: row.active,
      inactiveRecipes: row.inactive,
      averageDuration: Number(row.avg_dur),
      averageYieldRate: avgY,
      avgYieldRate: avgY,
      totalIngredients: ing.rows[0]?.n ?? 0,
    };
  }
}
