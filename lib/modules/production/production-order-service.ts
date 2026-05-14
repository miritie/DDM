/**
 * Service - Ordres de production
 *
 * Workflow :
 *   draft → submitted → planned → in_progress → completed
 *   (à tout moment sauf completed : cancelled)
 *
 * - submit()  : manager_production soumet pour validation admin
 * - approve() : admin valide la soumission (submitted → planned)
 * - start()   : manager_production lance la fabrication (planned → in_progress)
 * - consumeIngredients() : déclare conso réelle, décrémente stock MP, met à jour coût total
 * - createBatch() : enregistre un lot produit, crédite le stock produit fini
 * - complete() : in_progress → completed
 * - cancel()  : tout sauf completed
 *
 * Snapshot recipe_version à la création : un OP n'est pas impacté par une
 * édition ultérieure de la recette.
 *
 * Convention de retour : PascalCase via alias SQL pour compat UI.
 */
import { getPostgresClient } from '@/lib/database/postgres-client';
import {
  ProductionOrder, ProductionOrderStatus,
  IngredientConsumption, ProductionBatch,
} from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { RecipeService } from './recipe-service';
import { IngredientService } from './ingredient-service';
import { StockService } from '../stock/stock-service';

const db = getPostgresClient();
const recipeService = new RecipeService();
const ingredientService = new IngredientService();
const stockService = new StockService();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_PO = `
  SELECT
    id,
    production_order_id     AS "ProductionOrderId",
    order_number            AS "OrderNumber",
    recipe_id               AS "RecipeId",
    recipe_name             AS "RecipeName",
    recipe_version          AS "RecipeVersion",
    product_id              AS "ProductId",
    product_name            AS "ProductName",
    status                  AS "Status",
    planned_quantity        AS "PlannedQuantity",
    produced_quantity       AS "ProducedQuantity",
    unit                    AS "Unit",
    planned_start_date      AS "PlannedStartDate",
    planned_end_date        AS "PlannedEndDate",
    actual_start_date       AS "ActualStartDate",
    actual_end_date         AS "ActualEndDate",
    priority                AS "Priority",
    assigned_to_id          AS "AssignedToId",
    assigned_to_name        AS "AssignedToName",
    source_warehouse_id     AS "SourceWarehouseId",
    destination_warehouse_id AS "DestinationWarehouseId",
    customer_order_id       AS "CustomerOrderId",
    submitted_by_id         AS "SubmittedById",
    submitted_at            AS "SubmittedAt",
    approved_by_id          AS "ApprovedById",
    approved_at             AS "ApprovedAt",
    total_cost              AS "TotalCost",
    yield_rate              AS "YieldRate",
    notes                   AS "Notes",
    workspace_id            AS "WorkspaceId",
    created_at              AS "CreatedAt",
    updated_at              AS "UpdatedAt"
  FROM production_orders
`;

const SELECT_CONSUMPTION = `
  SELECT
    id,
    consumption_id         AS "ConsumptionId",
    production_order_id    AS "ProductionOrderId",
    ingredient_id          AS "IngredientId",
    ingredient_name        AS "IngredientName",
    planned_quantity       AS "PlannedQuantity",
    actual_quantity        AS "ActualQuantity",
    unit                   AS "Unit",
    unit_cost              AS "UnitCost",
    total_cost             AS "TotalCost",
    variance               AS "Variance",
    consumed_at            AS "ConsumedAt"
  FROM ingredient_consumptions
`;

const SELECT_BATCH = `
  SELECT
    id,
    batch_id              AS "BatchId",
    batch_number          AS "BatchNumber",
    production_order_id   AS "ProductionOrderId",
    product_id            AS "ProductId",
    product_name          AS "ProductName",
    quantity_produced     AS "QuantityProduced",
    quantity_defective    AS "QuantityDefective",
    quantity_good         AS "QuantityGood",
    unit                  AS "Unit",
    quality_score         AS "QualityScore",
    expiry_date           AS "ExpiryDate",
    production_date       AS "ProductionDate",
    notes                 AS "Notes",
    workspace_id          AS "WorkspaceId",
    created_at            AS "CreatedAt",
    updated_at            AS "UpdatedAt"
  FROM production_batches
`;

async function resolveUuid(table: string, slugCol: string | null, value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (UUID_RE.test(value)) return value;
  if (!slugCol) return null;
  const r = await db.query(`SELECT id FROM ${table} WHERE ${slugCol} = $1 OR id::text = $1 LIMIT 1`, [value]);
  return r.rows[0]?.id ?? null;
}

export interface CreateProductionOrderInput {
  recipeId: string;
  plannedQuantity: number;
  unit?: string;                     // si non fourni, prend recipe.outputUnit
  plannedStartDate: string;
  plannedEndDate: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedToId?: string;
  assignedToName?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  customerOrderId?: string | null;   // OP déclenché par commande négociée
  notes?: string;
  workspaceId: string;
  createdById?: string;              // qui crée l'OP (manager_production)
}

export interface UpdateProductionOrderInput {
  plannedQuantity?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedToId?: string;
  assignedToName?: string;
  notes?: string;
  destinationWarehouseId?: string;
  sourceWarehouseId?: string;
}

export interface ConsumeIngredientsInput {
  ingredients: Array<{ ingredientId: string; actualQuantity: number }>;
}

export interface CreateBatchInput {
  quantityProduced: number;
  quantityDefective?: number;
  qualityScore?: number;
  expiryDate?: string;
  notes?: string;
}

export class ProductionOrderService {

  async list(workspaceId: string, filters?: {
    status?: ProductionOrderStatus;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    assignedToId?: string;
    productId?: string;
    customerOrderId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<ProductionOrder[]> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    if (!wsUuid) return [];

    const conds: string[] = ['workspace_id = $1'];
    const params: any[] = [wsUuid];

    if (filters?.status) { params.push(filters.status); conds.push(`status = $${params.length}`); }
    if (filters?.priority) { params.push(filters.priority); conds.push(`priority = $${params.length}`); }
    if (filters?.assignedToId) {
      const u = await resolveUuid('users', 'user_id', filters.assignedToId);
      if (u) { params.push(u); conds.push(`assigned_to_id = $${params.length}`); }
    }
    if (filters?.productId) {
      const p = await resolveUuid('products', 'product_id', filters.productId);
      if (p) { params.push(p); conds.push(`product_id = $${params.length}`); }
    }
    if (filters?.customerOrderId) {
      const co = await resolveUuid('customer_orders', 'order_id', filters.customerOrderId);
      if (co) { params.push(co); conds.push(`customer_order_id = $${params.length}`); }
    }
    if (filters?.fromDate) { params.push(filters.fromDate); conds.push(`planned_start_date >= $${params.length}`); }
    if (filters?.toDate) { params.push(filters.toDate); conds.push(`planned_start_date <= $${params.length}`); }

    const r = await db.query(
      `${SELECT_PO} WHERE ${conds.join(' AND ')} ORDER BY order_number DESC`,
      params
    );
    const orders: ProductionOrder[] = r.rows;
    for (const order of orders) {
      order.IngredientConsumptions = await this.getIngredientConsumptions(order.id!);
      order.Batches = await this.getBatches(order.id!);
    }
    return orders;
  }

  async getById(idOrSlug: string): Promise<ProductionOrder | null> {
    const r = await db.query(
      `${SELECT_PO} WHERE id::text = $1 OR production_order_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    const order = r.rows[0];
    if (!order) return null;
    order.IngredientConsumptions = await this.getIngredientConsumptions(order.id);
    order.Batches = await this.getBatches(order.id);
    return order;
  }

  async getIngredientConsumptions(orderUuid: string): Promise<IngredientConsumption[]> {
    const r = await db.query(
      `${SELECT_CONSUMPTION} WHERE production_order_id = $1 ORDER BY consumed_at ASC`,
      [orderUuid]
    );
    return r.rows;
  }

  async getBatches(orderUuid: string): Promise<ProductionBatch[]> {
    const r = await db.query(
      `${SELECT_BATCH} WHERE production_order_id = $1 ORDER BY production_date DESC`,
      [orderUuid]
    );
    return r.rows;
  }

  private async generateOrderNumber(workspaceUuid: string): Promise<string> {
    const now = new Date();
    const prefix = `OP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const r = await db.query(
      `SELECT order_number FROM production_orders
       WHERE workspace_id = $1 AND order_number LIKE $2
       ORDER BY order_number DESC LIMIT 1`,
      [workspaceUuid, `${prefix}%`]
    );
    let next = 1;
    if (r.rows[0]) {
      const m = r.rows[0].order_number.match(/-(\d+)$/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  private async generateBatchNumber(workspaceUuid: string): Promise<string> {
    const now = new Date();
    const prefix = `LOT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const r = await db.query(
      `SELECT batch_number FROM production_batches
       WHERE workspace_id = $1 AND batch_number LIKE $2
       ORDER BY batch_number DESC LIMIT 1`,
      [workspaceUuid, `${prefix}%`]
    );
    let next = 1;
    if (r.rows[0]) {
      const m = r.rows[0].batch_number.match(/-(\d+)$/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    return `${prefix}-${String(next).padStart(4, '0')}`;
  }

  /**
   * Crée un OP en statut 'draft' avec consommations planifiées snapshot
   * basées sur recipe_lines × scaleFactor. Stocke aussi recipe_version pour
   * figer la formule.
   */
  async create(input: CreateProductionOrderInput): Promise<ProductionOrder> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', input.workspaceId);
    if (!wsUuid) throw new Error('Workspace introuvable');

    const recipe = await recipeService.getById(input.recipeId);
    if (!recipe) throw new Error('Recette introuvable');
    if (!recipe.IsActive) throw new Error('Cette recette est désactivée');

    const recipeUuid = recipe.id!;
    const productUuid = recipe.ProductId;
    const customerOrderUuid = input.customerOrderId
      ? await resolveUuid('customer_orders', 'order_id', input.customerOrderId)
      : null;
    const assignedToUuid = input.assignedToId
      ? await resolveUuid('users', 'user_id', input.assignedToId)
      : null;
    const sourceWhUuid = input.sourceWarehouseId
      ? await resolveUuid('warehouses', 'warehouse_id', input.sourceWarehouseId)
      : null;
    const destWhUuid = input.destinationWarehouseId
      ? await resolveUuid('warehouses', 'warehouse_id', input.destinationWarehouseId)
      : null;

    const orderNumber = await this.generateOrderNumber(wsUuid);
    const orderSlug = `PO-${uuidv4().slice(0, 8)}`;
    const scaleFactor = Number(input.plannedQuantity) / Number(recipe.OutputQuantity);

    const orderUuid = await db.transaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO production_orders (
           production_order_id, order_number, recipe_id, recipe_name, recipe_version,
           product_id, product_name, status, planned_quantity, produced_quantity, unit,
           planned_start_date, planned_end_date, priority,
           assigned_to_id, assigned_to_name,
           source_warehouse_id, destination_warehouse_id,
           customer_order_id, total_cost, yield_rate, notes, workspace_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,0,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,0,$18,$19)
         RETURNING id`,
        [
          orderSlug, orderNumber, recipeUuid, recipe.Name, recipe.Version,
          productUuid, recipe.ProductName ?? null,
          input.plannedQuantity, input.unit ?? recipe.OutputUnit,
          input.plannedStartDate, input.plannedEndDate,
          input.priority ?? 'normal',
          assignedToUuid, input.assignedToName ?? null,
          sourceWhUuid, destWhUuid,
          customerOrderUuid,
          input.notes ?? null, wsUuid,
        ]
      );
      const poUuid = ins.rows[0].id;

      for (const line of recipe.Lines) {
        const plannedQty = Number(line.Quantity) * scaleFactor;
        const ingMeta = await client.query(`SELECT unit_cost FROM ingredients WHERE id = $1`, [line.IngredientId]);
        const unitCost = Number(ingMeta.rows[0]?.unit_cost ?? 0);

        await client.query(
          `INSERT INTO ingredient_consumptions (
             consumption_id, production_order_id, ingredient_id, ingredient_name,
             planned_quantity, actual_quantity, unit, unit_cost, total_cost, variance, consumed_at
           ) VALUES ($1,$2,$3,$4,$5,0,$6,$7,0,0,CURRENT_TIMESTAMP)`,
          [
            `IC-${uuidv4().slice(0, 8)}`, poUuid, line.IngredientId, line.IngredientName ?? null,
            plannedQty, line.Unit, unitCost,
          ]
        );
      }
      return poUuid;
    });

    return (await this.getById(orderUuid))!;
  }

  async update(idOrSlug: string, updates: UpdateProductionOrderInput): Promise<ProductionOrder> {
    const order = await this.getById(idOrSlug);
    if (!order) throw new Error('Ordre de production introuvable');

    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [];
    const push = (col: string, v: any) => { params.push(v); sets.push(`${col} = $${params.length}`); };

    if (updates.plannedQuantity !== undefined) push('planned_quantity', updates.plannedQuantity);
    if (updates.plannedStartDate !== undefined) push('planned_start_date', updates.plannedStartDate);
    if (updates.plannedEndDate !== undefined) push('planned_end_date', updates.plannedEndDate);
    if (updates.actualStartDate !== undefined) push('actual_start_date', updates.actualStartDate);
    if (updates.actualEndDate !== undefined) push('actual_end_date', updates.actualEndDate);
    if (updates.priority !== undefined) push('priority', updates.priority);
    if (updates.assignedToId !== undefined) {
      const u = updates.assignedToId ? await resolveUuid('users', 'user_id', updates.assignedToId) : null;
      push('assigned_to_id', u);
    }
    if (updates.assignedToName !== undefined) push('assigned_to_name', updates.assignedToName);
    if (updates.notes !== undefined) push('notes', updates.notes);
    if (updates.destinationWarehouseId !== undefined) {
      const w = updates.destinationWarehouseId ? await resolveUuid('warehouses', 'warehouse_id', updates.destinationWarehouseId) : null;
      push('destination_warehouse_id', w);
    }
    if (updates.sourceWarehouseId !== undefined) {
      const w = updates.sourceWarehouseId ? await resolveUuid('warehouses', 'warehouse_id', updates.sourceWarehouseId) : null;
      push('source_warehouse_id', w);
    }

    params.push(order.id);
    await db.query(`UPDATE production_orders SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    return (await this.getById(order.id!))!;
  }

  // -----------------------------------------------------------------------
  // WORKFLOW

  async submit(idOrSlug: string, submittedById: string): Promise<ProductionOrder> {
    const order = await this.getById(idOrSlug);
    if (!order) throw new Error('Ordre de production introuvable');
    if (order.Status !== 'draft') {
      throw new Error(`Seul un OP en brouillon peut être soumis (statut actuel : ${order.Status})`);
    }
    const submitterUuid = await resolveUuid('users', 'user_id', submittedById);
    await db.query(
      `UPDATE production_orders
         SET status = 'submitted', submitted_by_id = $2, submitted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id, submitterUuid]
    );
    return (await this.getById(order.id!))!;
  }

  async approve(idOrSlug: string, approvedById: string): Promise<ProductionOrder> {
    const order = await this.getById(idOrSlug);
    if (!order) throw new Error('Ordre de production introuvable');
    if (order.Status !== 'submitted') {
      throw new Error(
        `Seul un OP soumis peut être approuvé (statut actuel : ${order.Status}). ` +
        `Le manager de production doit d'abord soumettre.`
      );
    }
    const approverUuid = await resolveUuid('users', 'user_id', approvedById);
    await db.query(
      `UPDATE production_orders
         SET status = 'planned', approved_by_id = $2, approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id, approverUuid]
    );
    return (await this.getById(order.id!))!;
  }

  async start(idOrSlug: string): Promise<ProductionOrder> {
    const order = await this.getById(idOrSlug);
    if (!order) throw new Error('Ordre de production introuvable');
    if (order.Status !== 'planned') {
      throw new Error('Seuls les ordres planifiés (approuvés) peuvent être démarrés');
    }

    // Vérification stock MP disponible
    for (const cons of order.IngredientConsumptions) {
      const ing = await ingredientService.getById(cons.IngredientId);
      if (!ing) throw new Error(`Ingrédient ${cons.IngredientName} introuvable`);
      if (Number(ing.CurrentStock) < Number(cons.PlannedQuantity)) {
        throw new Error(
          `Stock insuffisant pour ${ing.Name} : ${ing.CurrentStock} ${ing.Unit} dispo, ` +
          `${cons.PlannedQuantity} ${cons.Unit} requis`
        );
      }
    }

    await db.query(
      `UPDATE production_orders
         SET status = 'in_progress', actual_start_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id]
    );
    return (await this.getById(order.id!))!;
  }

  async consumeIngredients(idOrSlug: string, input: ConsumeIngredientsInput): Promise<ProductionOrder> {
    const order = await this.getById(idOrSlug);
    if (!order) throw new Error('Ordre de production introuvable');
    if (order.Status !== 'in_progress') {
      throw new Error('Seuls les ordres en cours peuvent consommer des ingrédients');
    }

    let totalAddedCost = 0;

    await db.transaction(async (client) => {
      for (const item of input.ingredients) {
        const ingUuid = await resolveUuid('ingredients', 'ingredient_id', item.ingredientId);
        if (!ingUuid) throw new Error(`Ingrédient ${item.ingredientId} introuvable`);

        const cons = order.IngredientConsumptions.find((c) => c.IngredientId === ingUuid);
        if (!cons) {
          throw new Error(`Ingrédient ${item.ingredientId} non prévu dans cette recette`);
        }

        // Décrémente stock MP (avec verrou)
        const ingR = await client.query(
          `SELECT current_stock, unit_cost, name, unit FROM ingredients WHERE id = $1 FOR UPDATE`,
          [ingUuid]
        );
        const ingRow = ingR.rows[0];
        if (!ingRow) throw new Error(`Ingrédient ${ingUuid} introuvable`);
        if (Number(ingRow.current_stock) < Number(item.actualQuantity)) {
          throw new Error(
            `Stock insuffisant pour ${ingRow.name} : ${ingRow.current_stock} ${ingRow.unit} dispo, ` +
            `${item.actualQuantity} ${ingRow.unit} demandé(s)`
          );
        }
        await client.query(
          `UPDATE ingredients SET current_stock = current_stock - $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [ingUuid, item.actualQuantity]
        );

        // PMP figé à la consommation = unit_cost courant lu à l'instant
        const unitCost = Number(ingRow.unit_cost);
        const consCost = Number(item.actualQuantity) * unitCost;
        const variance = Number(cons.PlannedQuantity) > 0
          ? ((Number(item.actualQuantity) - Number(cons.PlannedQuantity)) / Number(cons.PlannedQuantity)) * 100
          : 0;

        await client.query(
          `UPDATE ingredient_consumptions
             SET actual_quantity = $2, unit_cost = $3, total_cost = $4,
                 variance = $5, consumed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [cons.id, item.actualQuantity, unitCost, consCost, variance]
        );

        totalAddedCost += consCost;
      }

      // Met à jour total_cost de l'OP
      await client.query(
        `UPDATE production_orders SET total_cost = total_cost + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [order.id, totalAddedCost]
      );
    });

    return (await this.getById(order.id!))!;
  }

  async createBatch(idOrSlug: string, input: CreateBatchInput): Promise<ProductionBatch> {
    const order = await this.getById(idOrSlug);
    if (!order) throw new Error('Ordre de production introuvable');
    if (order.Status !== 'in_progress') {
      throw new Error('Seuls les ordres en cours peuvent créer des lots');
    }

    const defective = Number(input.quantityDefective ?? 0);
    const good = Number(input.quantityProduced) - defective;
    if (good < 0) throw new Error('Quantité défectueuse > quantité produite');

    const batchNumber = await this.generateBatchNumber(order.WorkspaceId);
    const batchSlug = `BCH-${uuidv4().slice(0, 8)}`;

    const newProduced = Number(order.ProducedQuantity) + good;
    const yieldRate = Number(order.PlannedQuantity) > 0
      ? (newProduced / Number(order.PlannedQuantity)) * 100
      : 0;

    await db.transaction(async (client) => {
      await client.query(
        `INSERT INTO production_batches (
           batch_id, batch_number, production_order_id, product_id, product_name,
           quantity_produced, quantity_defective, quantity_good, unit,
           quality_score, expiry_date, production_date, notes, workspace_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CURRENT_DATE,$12,$13)`,
        [
          batchSlug, batchNumber, order.id, order.ProductId, order.ProductName,
          input.quantityProduced, defective, good, order.Unit,
          input.qualityScore ?? null, input.expiryDate ?? null,
          input.notes ?? null, order.WorkspaceId,
        ]
      );

      await client.query(
        `UPDATE production_orders
           SET produced_quantity = $2, yield_rate = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [order.id, newProduced, yieldRate]
      );
    });

    // Intégration stock produit fini : on passe en dehors de la transaction principale
    // (stockService gère sa propre transaction interne)
    if (order.DestinationWarehouseId && good > 0) {
      const costPerUnit = newProduced > 0 ? Number(order.TotalCost) / newProduced : 0;
      await stockService.upsertStockItem({
        productId: order.ProductId,
        warehouseId: order.DestinationWarehouseId,
        quantity: good,
        minimumStock: 0,
        unitCost: costPerUnit,
        workspaceId: order.WorkspaceId,
      });
    }

    const r = await db.query(`${SELECT_BATCH} WHERE batch_id = $1`, [batchSlug]);
    return r.rows[0];
  }

  async complete(idOrSlug: string): Promise<ProductionOrder> {
    const order = await this.getById(idOrSlug);
    if (!order) throw new Error('Ordre de production introuvable');
    if (order.Status !== 'in_progress') {
      throw new Error('Seuls les ordres en cours peuvent être complétés');
    }
    if (order.Batches.length === 0) {
      throw new Error('Au moins un lot doit être créé avant de compléter l\'ordre');
    }
    await db.query(
      `UPDATE production_orders
         SET status = 'completed', actual_end_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id]
    );
    return (await this.getById(order.id!))!;
  }

  async cancel(idOrSlug: string, reason?: string): Promise<ProductionOrder> {
    const order = await this.getById(idOrSlug);
    if (!order) throw new Error('Ordre de production introuvable');
    if (order.Status === 'completed') {
      throw new Error('Un OP complété ne peut pas être annulé');
    }
    const newNotes = reason
      ? `${order.Notes ? order.Notes + '\n' : ''}Annulé: ${reason}`
      : order.Notes;
    await db.query(
      `UPDATE production_orders
         SET status = 'cancelled', notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [order.id, newNotes]
    );
    return (await this.getById(order.id!))!;
  }

  async getStatistics(workspaceId: string, dateRange?: { from: string; to: string }): Promise<{
    totalOrders: number;
    byStatus: Record<ProductionOrderStatus, number>;
    totalProducedQuantity: number;
    averageYieldRate: number;
    totalCost: number;
    onTimeDelivery: number;
    ordersInProgress: number;
  }> {
    const wsUuid = await resolveUuid('workspaces', 'workspace_id', workspaceId);
    const byStatus: Record<ProductionOrderStatus, number> = {
      draft: 0, submitted: 0, planned: 0, in_progress: 0, completed: 0, cancelled: 0,
    };
    if (!wsUuid) {
      return { totalOrders: 0, byStatus, totalProducedQuantity: 0,
               averageYieldRate: 0, totalCost: 0, onTimeDelivery: 0, ordersInProgress: 0 };
    }

    const params: any[] = [wsUuid];
    const conds: string[] = ['workspace_id = $1'];
    if (dateRange) {
      params.push(dateRange.from, dateRange.to);
      conds.push(`planned_start_date BETWEEN $${params.length - 1} AND $${params.length}`);
    }

    const r = await db.query(
      `SELECT
         status,
         COUNT(*)::int AS n,
         COALESCE(SUM(produced_quantity), 0)::numeric AS produced,
         COALESCE(AVG(yield_rate), 0)::numeric        AS avg_yield,
         COALESCE(SUM(total_cost), 0)::numeric        AS total_cost,
         SUM(CASE WHEN status='completed' AND actual_end_date <= planned_end_date THEN 1 ELSE 0 END)::int AS on_time,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END)::int AS completed_count
       FROM production_orders WHERE ${conds.join(' AND ')} GROUP BY status`,
      params
    );

    let totalOrders = 0;
    let totalProduced = 0;
    let totalCost = 0;
    let yieldSum = 0;
    let yieldN = 0;
    let onTime = 0;
    let completed = 0;
    for (const row of r.rows) {
      byStatus[row.status as ProductionOrderStatus] = row.n;
      totalOrders += row.n;
      totalProduced += Number(row.produced);
      totalCost += Number(row.total_cost);
      yieldSum += Number(row.avg_yield) * row.n;
      yieldN += row.n;
      onTime += row.on_time;
      completed += row.completed_count;
    }

    return {
      totalOrders,
      byStatus,
      totalProducedQuantity: totalProduced,
      averageYieldRate: yieldN > 0 ? yieldSum / yieldN : 0,
      totalCost,
      onTimeDelivery: completed > 0 ? (onTime / completed) * 100 : 0,
      ordersInProgress: byStatus.in_progress,
    };
  }
}
