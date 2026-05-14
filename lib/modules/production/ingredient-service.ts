/**
 * Service - Gestion des Matières Premières (ingredients)
 *
 * Mise à jour 2026-05-14 :
 *   - réécriture en SQL direct via pool.query() (plus de filterByFormula
 *     ni record.id, qui étaient buggés dans postgres-client legacy).
 *   - PMP : unit_cost est désormais le Prix Moyen Pondéré recalculé à chaque
 *     réception via receive(). Historique exhaustif dans ingredient_receptions.
 *   - kind : 'raw' (achetée chez fournisseur) | 'semi' (fabriquée en interne
 *     via une recipe interne — récursion BOM 2 niveaux max).
 *
 * Convention de retour : PascalCase via alias SQL pour compat UI existante.
 */
import { getPostgresClient } from '@/lib/database/postgres-client';
import { Ingredient, IngredientKind, IngredientReception } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_INGREDIENT = `
  SELECT
    id,
    ingredient_id                   AS "IngredientId",
    name                            AS "Name",
    code                            AS "Code",
    description                     AS "Description",
    unit                            AS "Unit",
    unit_cost                       AS "UnitCost",
    currency                        AS "Currency",
    minimum_stock                   AS "MinimumStock",
    current_stock                   AS "CurrentStock",
    supplier                        AS "Supplier",
    kind                            AS "Kind",
    recipe_id                       AS "RecipeId",
    preferred_supplier_account_id   AS "PreferredSupplierAccountId",
    is_active                       AS "IsActive",
    workspace_id                    AS "WorkspaceId",
    created_at                      AS "CreatedAt",
    updated_at                      AS "UpdatedAt"
  FROM ingredients
`;

async function resolveUuid(table: string, slugCol: string | null, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (UUID_RE.test(value)) return value;
  if (!slugCol) return null;
  const r = await db.query(`SELECT id FROM ${table} WHERE ${slugCol} = $1 OR id::text = $1 LIMIT 1`, [value]);
  return r.rows[0]?.id ?? null;
}

export interface CreateIngredientInput {
  name: string;
  code: string;
  description?: string;
  unit: string;
  unitCost: number;                       // PMP initial (= prix premier achat estimé)
  currency?: string;                      // défaut 'XOF'
  minimumStock?: number;                  // défaut 0
  supplier?: string;                      // legacy texte libre — optionnel
  kind?: IngredientKind;                  // défaut 'raw'
  recipeId?: string | null;               // requis si kind='semi'
  preferredSupplierAccountId?: string | null;
  workspaceId: string;
}

export interface UpdateIngredientInput {
  name?: string;
  code?: string;
  description?: string;
  unit?: string;
  minimumStock?: number;
  supplier?: string;
  kind?: IngredientKind;
  recipeId?: string | null;
  preferredSupplierAccountId?: string | null;
  isActive?: boolean;
}

export class IngredientService {

  async list(workspaceId: string, filters?: {
    isActive?: boolean;
    belowMinimum?: boolean;
    kind?: IngredientKind;
  }): Promise<Ingredient[]> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) return [];

    const conds: string[] = ['workspace_id = $1'];
    const params: any[] = [wsUuid];

    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      conds.push(`is_active = $${params.length}`);
    }
    if (filters?.kind) {
      params.push(filters.kind);
      conds.push(`kind = $${params.length}`);
    }
    if (filters?.belowMinimum) {
      conds.push('current_stock < minimum_stock');
    }

    const r = await db.query(
      `${SELECT_INGREDIENT} WHERE ${conds.join(' AND ')} ORDER BY name ASC`,
      params
    );
    return r.rows;
  }

  async getById(idOrSlug: string): Promise<Ingredient | null> {
    const r = await db.query(
      `${SELECT_INGREDIENT} WHERE id::text = $1 OR ingredient_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    return r.rows[0] ?? null;
  }

  async getByCode(workspaceId: string, code: string): Promise<Ingredient | null> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) return null;
    const r = await db.query(
      `${SELECT_INGREDIENT} WHERE workspace_id = $1 AND code = $2 LIMIT 1`,
      [wsUuid, code]
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateIngredientInput): Promise<Ingredient> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', input.workspaceId);
    if (!wsUuid) throw new Error('Workspace introuvable');

    if (await this.getByCode(input.workspaceId, input.code)) {
      throw new Error(`Un ingrédient avec le code ${input.code} existe déjà`);
    }

    const kind: IngredientKind = input.kind ?? 'raw';
    if (kind === 'semi' && !input.recipeId) {
      throw new Error('Un ingrédient semi-fini doit référencer une recette');
    }

    const recipeUuid = input.recipeId
      ? await resolveUuid('recipes', 'recipe_id', input.recipeId)
      : null;
    const supplierUuid = input.preferredSupplierAccountId
      ? await resolveUuid('accounts', 'account_id', input.preferredSupplierAccountId)
      : null;

    const ingredientId = `ING-${uuidv4().slice(0, 8)}`;

    const r = await db.query(
      `INSERT INTO ingredients (
         ingredient_id, name, code, description, unit, unit_cost, currency,
         minimum_stock, current_stock, supplier, kind, recipe_id,
         preferred_supplier_account_id, is_active, workspace_id
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$10,$11,$12,true,$13)
       RETURNING id`,
      [
        ingredientId,
        input.name,
        input.code,
        input.description ?? null,
        input.unit,
        Number(input.unitCost) || 0,
        input.currency ?? 'XOF',
        Number(input.minimumStock) || 0,
        input.supplier ?? null,
        kind,
        recipeUuid,
        supplierUuid,
        wsUuid,
      ]
    );

    const created = await this.getById(r.rows[0].id);
    if (!created) throw new Error('Ingrédient créé mais introuvable');
    return created;
  }

  async update(idOrSlug: string, updates: UpdateIngredientInput): Promise<Ingredient> {
    const ing = await this.getById(idOrSlug);
    if (!ing) throw new Error('Ingrédient introuvable');

    if (updates.code && updates.code !== ing.Code) {
      const dup = await this.getByCode(ing.WorkspaceId, updates.code);
      if (dup) throw new Error('Un ingrédient avec ce code existe déjà');
    }

    const sets: string[] = [];
    const params: any[] = [];
    const push = (col: string, v: any) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (updates.name !== undefined) push('name', updates.name);
    if (updates.code !== undefined) push('code', updates.code);
    if (updates.description !== undefined) push('description', updates.description);
    if (updates.unit !== undefined) push('unit', updates.unit);
    if (updates.minimumStock !== undefined) push('minimum_stock', updates.minimumStock);
    if (updates.supplier !== undefined) push('supplier', updates.supplier);
    if (updates.kind !== undefined) push('kind', updates.kind);
    if (updates.recipeId !== undefined) {
      const recipeUuid = updates.recipeId
        ? await resolveUuid('recipes', 'recipe_id', updates.recipeId)
        : null;
      push('recipe_id', recipeUuid);
    }
    if (updates.preferredSupplierAccountId !== undefined) {
      const supplierUuid = updates.preferredSupplierAccountId
        ? await resolveUuid('accounts', 'account_id', updates.preferredSupplierAccountId)
        : null;
      push('preferred_supplier_account_id', supplierUuid);
    }
    if (updates.isActive !== undefined) push('is_active', updates.isActive);

    if (sets.length === 0) return ing;

    params.push(ing.id);
    await db.query(`UPDATE ingredients SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    const updated = await this.getById(ing.id!);
    return updated!;
  }

  /**
   * Réception MP : ajoute au stock + recalcule PMP + trace.
   * Si purchaseRequestLineId fourni, met également à jour la ligne PR.
   */
  async receive(input: {
    ingredientId: string;
    qty: number;
    unitPrice: number;
    supplierAccountId?: string | null;
    purchaseRequestLineId?: string | null;
    receivedById?: string | null;
    expenseId?: string | null;
    notes?: string;
  }): Promise<{ ingredient: Ingredient; reception: IngredientReception }> {
    if (input.qty <= 0) throw new Error('La quantité reçue doit être > 0');
    if (input.unitPrice < 0) throw new Error('Le prix unitaire ne peut pas être négatif');

    const ing = await this.getById(input.ingredientId);
    if (!ing) throw new Error('Ingrédient introuvable');

    const stockBefore = Number(ing.CurrentStock);
    const pmpBefore = Number(ing.UnitCost);
    const stockAfter = stockBefore + Number(input.qty);
    // PMP pondéré : si stockBefore = 0, on prend juste unitPrice
    const pmpAfter = stockBefore <= 0
      ? Number(input.unitPrice)
      : (stockBefore * pmpBefore + Number(input.qty) * Number(input.unitPrice)) / stockAfter;

    const supplierUuid = input.supplierAccountId
      ? await resolveUuid('accounts', 'account_id', input.supplierAccountId)
      : null;
    const prlUuid = input.purchaseRequestLineId
      ? await resolveUuid('purchase_request_lines', 'purchase_request_line_id', input.purchaseRequestLineId)
      : null;
    const expenseUuid = input.expenseId
      ? await resolveUuid('expenses', 'expense_id', input.expenseId)
      : null;
    const receivedByUuid = input.receivedById
      ? await resolveUuid('users', 'user_id', input.receivedById)
      : null;

    const receptionId = `RCP-${uuidv4().slice(0, 8)}`;
    const totalCost = Number(input.qty) * Number(input.unitPrice);

    await db.transaction(async (client) => {
      // 1. Mettre à jour le stock et le PMP
      await client.query(
        `UPDATE ingredients
           SET current_stock = $2, unit_cost = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [ing.id, stockAfter, pmpAfter]
      );

      // 2. Insérer la trace
      await client.query(
        `INSERT INTO ingredient_receptions (
           reception_id, ingredient_id, purchase_request_line_id, supplier_account_id,
           qty, unit, unit_price, total_cost, received_by_id, expense_id,
           pmp_before, pmp_after, stock_before, stock_after, notes, workspace_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          receptionId, ing.id, prlUuid, supplierUuid,
          input.qty, ing.Unit, input.unitPrice, totalCost, receivedByUuid, expenseUuid,
          pmpBefore, pmpAfter, stockBefore, stockAfter,
          input.notes ?? null, ing.WorkspaceId,
        ]
      );

      // 3. Si lié à une ligne purchase_request, mettre à jour qty_received / actual_total
      if (prlUuid) {
        await client.query(
          `UPDATE purchase_request_lines
             SET qty_received = qty_received + $2,
                 actual_total = actual_total + $3,
                 updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [prlUuid, input.qty, totalCost]
        );
      }
    });

    const updated = await this.getById(ing.id!);
    const recR = await db.query(
      `SELECT
         id,
         reception_id              AS "ReceptionId",
         ingredient_id             AS "IngredientId",
         purchase_request_line_id  AS "PurchaseRequestLineId",
         supplier_account_id       AS "SupplierAccountId",
         qty                       AS "Qty",
         unit                      AS "Unit",
         unit_price                AS "UnitPrice",
         total_cost                AS "TotalCost",
         received_by_id            AS "ReceivedById",
         received_at               AS "ReceivedAt",
         expense_id                AS "ExpenseId",
         pmp_before                AS "PmpBefore",
         pmp_after                 AS "PmpAfter",
         stock_before              AS "StockBefore",
         stock_after               AS "StockAfter",
         notes                     AS "Notes",
         workspace_id              AS "WorkspaceId",
         created_at                AS "CreatedAt"
       FROM ingredient_receptions WHERE reception_id = $1`,
      [receptionId]
    );

    return { ingredient: updated!, reception: recR.rows[0] };
  }

  /**
   * Décrémente le stock (consommation en production).
   * Ne touche PAS au PMP — c'est une sortie, pas un mouvement de valorisation.
   */
  async decreaseStock(idOrSlug: string, qty: number): Promise<Ingredient> {
    if (qty <= 0) throw new Error('La quantité doit être positive');
    const ing = await this.getById(idOrSlug);
    if (!ing) throw new Error('Ingrédient introuvable');
    if (Number(ing.CurrentStock) < qty) {
      throw new Error(
        `Stock insuffisant pour ${ing.Name} : ${ing.CurrentStock} ${ing.Unit} dispo, ${qty} demandé(s)`
      );
    }
    await db.query(
      `UPDATE ingredients
         SET current_stock = current_stock - $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ing.id, qty]
    );
    return (await this.getById(ing.id!))!;
  }

  /**
   * Conservé pour rétro-compat — préfère receive() qui trace tout.
   */
  async increaseStock(idOrSlug: string, qty: number, unitCost?: number): Promise<Ingredient> {
    const ing = await this.getById(idOrSlug);
    if (!ing) throw new Error('Ingrédient introuvable');
    if (qty <= 0) throw new Error('La quantité doit être positive');
    const { ingredient } = await this.receive({
      ingredientId: ing.id!,
      qty,
      unitPrice: unitCost ?? Number(ing.UnitCost),
      notes: 'increaseStock() legacy',
    });
    return ingredient;
  }

  async deactivate(idOrSlug: string): Promise<Ingredient> {
    return this.update(idOrSlug, { isActive: false });
  }

  async activate(idOrSlug: string): Promise<Ingredient> {
    return this.update(idOrSlug, { isActive: true });
  }

  async getBelowMinimum(workspaceId: string): Promise<Ingredient[]> {
    return this.list(workspaceId, { isActive: true, belowMinimum: true });
  }

  async getStatistics(workspaceId: string): Promise<{
    totalIngredients: number;
    activeIngredients: number;
    inactiveIngredients: number;
    belowMinimum: number;
    totalValue: number;
    rawCount: number;
    semiCount: number;
  }> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) {
      return { totalIngredients: 0, activeIngredients: 0, inactiveIngredients: 0,
               belowMinimum: 0, totalValue: 0, rawCount: 0, semiCount: 0 };
    }
    const r = await db.query(
      `SELECT
         COUNT(*)::int                                                            AS total,
         SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int                          AS active,
         SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END)::int                      AS inactive,
         SUM(CASE WHEN is_active AND current_stock < minimum_stock THEN 1 ELSE 0 END)::int AS below_min,
         COALESCE(SUM(current_stock * unit_cost), 0)::numeric                     AS total_value,
         SUM(CASE WHEN kind = 'raw' THEN 1 ELSE 0 END)::int                       AS raw_count,
         SUM(CASE WHEN kind = 'semi' THEN 1 ELSE 0 END)::int                      AS semi_count
       FROM ingredients WHERE workspace_id = $1`,
      [wsUuid]
    );
    const row = r.rows[0];
    return {
      totalIngredients: row.total,
      activeIngredients: row.active,
      inactiveIngredients: row.inactive,
      belowMinimum: row.below_min,
      totalValue: Number(row.total_value),
      rawCount: row.raw_count,
      semiCount: row.semi_count,
    };
  }
}
