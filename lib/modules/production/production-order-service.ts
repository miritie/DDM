/**
 * Service - Gestion des Ordres de Production
 * Module Production & Usine
 */

import { AirtableClient } from '@/lib/airtable/client';
import {
  ProductionOrder,
  ProductionOrderStatus,
  IngredientConsumption,
  ProductionBatch,
  Recipe,
  Ingredient,
} from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { RecipeService } from './recipe-service';
import { IngredientService } from './ingredient-service';
import { StockService } from '../stock/stock-service';

const airtableClient = new AirtableClient();
const recipeService = new RecipeService();
const ingredientService = new IngredientService();
const stockService = new StockService();

export interface CreateProductionOrderInput {
  recipeId: string;
  plannedQuantity: number;
  unit: string;
  plannedStartDate: string;
  plannedEndDate: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedToId?: string;
  assignedToName?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  notes?: string;
  workspaceId: string;
}

export interface UpdateProductionOrderInput {
  status?: ProductionOrderStatus;
  plannedQuantity?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedToId?: string;
  assignedToName?: string;
  notes?: string;
}

export interface ConsumeIngredientsInput {
  ingredients: Array<{
    ingredientId: string;
    actualQuantity: number;
  }>;
}

export interface CreateBatchInput {
  quantityProduced: number;
  quantityDefective: number;
  qualityScore?: number;
  expiryDate?: string;
  notes?: string;
}

/**
 * Service de gestion des ordres de production
 */
export class ProductionOrderService {
  /**
   * Liste tous les ordres de production
   */
  async list(
    workspaceId: string,
    filters?: {
      status?: ProductionOrderStatus;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      assignedToId?: string;
      productId?: string;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<ProductionOrder[]> {
    let formulaParts = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters?.status) {
      formulaParts.push(`{Status} = '${filters.status}'`);
    }

    if (filters?.priority) {
      formulaParts.push(`{Priority} = '${filters.priority}'`);
    }

    if (filters?.assignedToId) {
      formulaParts.push(`{AssignedToId} = '${filters.assignedToId}'`);
    }

    if (filters?.productId) {
      formulaParts.push(`{ProductId} = '${filters.productId}'`);
    }

    if (filters?.fromDate) {
      formulaParts.push(`{PlannedStartDate} >= '${filters.fromDate}'`);
    }

    if (filters?.toDate) {
      formulaParts.push(`{PlannedStartDate} <= '${filters.toDate}'`);
    }

    const orders = await airtableClient.list<ProductionOrder>('ProductionOrder', {
      filterByFormula: `AND(${formulaParts.join(', ')})`,
      sort: [{ field: 'OrderNumber', direction: 'desc' }],
    });

    // Charger les consommations et batches pour chaque ordre
    for (const order of orders) {
      order.IngredientConsumptions = await this.getIngredientConsumptions(order.ProductionOrderId);
      order.Batches = await this.getBatches(order.ProductionOrderId);
    }

    return orders;
  }

  /**
   * Récupère un ordre de production par ID
   */
  async getById(productionOrderId: string): Promise<ProductionOrder | null> {
    const results = await airtableClient.list<ProductionOrder>('ProductionOrder', {
      filterByFormula: `{ProductionOrderId} = '${productionOrderId}'`,
    });

    if (results.length === 0) {
      return null;
    }

    const order = results[0];
    order.IngredientConsumptions = await this.getIngredientConsumptions(productionOrderId);
    order.Batches = await this.getBatches(productionOrderId);

    return order;
  }

  /**
   * Récupère un ordre par numéro
   */
  async getByNumber(workspaceId: string, orderNumber: string): Promise<ProductionOrder | null> {
    const results = await airtableClient.list<ProductionOrder>('ProductionOrder', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {OrderNumber} = '${orderNumber}')`,
    });

    if (results.length === 0) {
      return null;
    }

    const order = results[0];
    order.IngredientConsumptions = await this.getIngredientConsumptions(order.ProductionOrderId);
    order.Batches = await this.getBatches(order.ProductionOrderId);

    return order;
  }

  /**
   * Récupère les consommations d'ingrédients d'un ordre
   */
  async getIngredientConsumptions(productionOrderId: string): Promise<IngredientConsumption[]> {
    return await airtableClient.list<IngredientConsumption>('IngredientConsumption', {
      filterByFormula: `{ProductionOrderId} = '${productionOrderId}'`,
      sort: [{ field: 'ConsumedAt', direction: 'asc' }],
    });
  }

  /**
   * Récupère les batches/lots produits d'un ordre
   */
  async getBatches(productionOrderId: string): Promise<ProductionBatch[]> {
    return await airtableClient.list<ProductionBatch>('ProductionBatch', {
      filterByFormula: `{ProductionOrderId} = '${productionOrderId}'`,
      sort: [{ field: 'ProductionDate', direction: 'desc' }],
    });
  }

  /**
   * Génère le prochain numéro d'ordre de production
   */
  private async generateOrderNumber(workspaceId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `OP-${year}${month}`;

    const existingOrders = await airtableClient.list<ProductionOrder>('ProductionOrder', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', SEARCH('${prefix}', {OrderNumber}) = 1)`,
      sort: [{ field: 'OrderNumber', direction: 'desc' }],
    });

    let nextNumber = 1;
    if (existingOrders.length > 0) {
      const lastNumber = existingOrders[0].OrderNumber;
      const match = lastNumber.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Crée un nouvel ordre de production
   */
  async create(input: CreateProductionOrderInput): Promise<ProductionOrder> {
    // Récupérer la recette
    const recipe = await recipeService.getById(input.recipeId);
    if (!recipe) {
      throw new Error('Recette non trouvée');
    }

    if (!recipe.IsActive) {
      throw new Error('Cette recette est désactivée');
    }

    const orderNumber = await this.generateOrderNumber(input.workspaceId);
    const productionOrderId = uuidv4();

    // Calculer la quantité d'ingrédients nécessaires
    const scaleFactor = input.plannedQuantity / recipe.OutputQuantity;

    const order: Partial<ProductionOrder> = {
      ProductionOrderId: productionOrderId,
      OrderNumber: orderNumber,
      RecipeId: input.recipeId,
      RecipeName: recipe.Name,
      ProductId: recipe.ProductId,
      ProductName: recipe.ProductName,
      Status: 'draft',
      PlannedQuantity: input.plannedQuantity,
      ProducedQuantity: 0,
      Unit: input.unit,
      PlannedStartDate: input.plannedStartDate,
      PlannedEndDate: input.plannedEndDate,
      Priority: input.priority,
      AssignedToId: input.assignedToId,
      AssignedToName: input.assignedToName,
      SourceWarehouseId: input.sourceWarehouseId,
      DestinationWarehouseId: input.destinationWarehouseId,
      TotalCost: 0,
      YieldRate: 0,
      Notes: input.notes,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdOrder = await airtableClient.create<ProductionOrder>('ProductionOrder', order);

    // Créer les consommations planifiées d'ingrédients
    const consumptions: IngredientConsumption[] = [];
    for (const line of recipe.Lines) {
      const plannedQty = line.Quantity * scaleFactor;

      // Récupérer le coût unitaire de l'ingrédient
      const ingredient = await ingredientService.getById(line.IngredientId);
      const unitCost = ingredient?.UnitCost || 0;

      const consumption: Partial<IngredientConsumption> = {
        ConsumptionId: uuidv4(),
        ProductionOrderId: productionOrderId,
        IngredientId: line.IngredientId,
        IngredientName: line.IngredientName,
        PlannedQuantity: plannedQty,
        ActualQuantity: 0,
        Unit: line.Unit,
        UnitCost: unitCost,
        TotalCost: 0,
        Variance: 0,
        ConsumedAt: new Date().toISOString(),
      };

      const createdConsumption = await airtableClient.create<IngredientConsumption>(
        'IngredientConsumption',
        consumption
      );
      consumptions.push(createdConsumption);
    }

    createdOrder.IngredientConsumptions = consumptions;
    createdOrder.Batches = [];

    return createdOrder;
  }

  /**
   * Met à jour un ordre de production
   */
  async update(productionOrderId: string, updates: UpdateProductionOrderInput): Promise<ProductionOrder> {
    const order = await this.getById(productionOrderId);
    if (!order) {
      throw new Error('Ordre de production non trouvé');
    }

    // Vérifier les transitions de statut autorisées
    if (updates.status && updates.status !== order.Status) {
      this.validateStatusTransition(order.Status, updates.status);
    }

    const records = await airtableClient.list<ProductionOrder>('ProductionOrder', {
      filterByFormula: `{ProductionOrderId} = '${productionOrderId}'`,
    });

    if (records.length === 0) {
      throw new Error('Ordre de production non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    const updatedOrder = await airtableClient.update<ProductionOrder>('ProductionOrder', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });

    updatedOrder.IngredientConsumptions = await this.getIngredientConsumptions(productionOrderId);
    updatedOrder.Batches = await this.getBatches(productionOrderId);

    return updatedOrder;
  }

  /**
   * Valide les transitions de statut
   */
  private validateStatusTransition(currentStatus: ProductionOrderStatus, newStatus: ProductionOrderStatus): void {
    const allowedTransitions: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
      draft: ['planned', 'cancelled'],
      planned: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    const allowed = allowedTransitions[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Transition de statut non autorisée: ${currentStatus} → ${newStatus}`
      );
    }
  }

  /**
   * Démarre un ordre de production
   */
  async start(productionOrderId: string): Promise<ProductionOrder> {
    const order = await this.getById(productionOrderId);
    if (!order) {
      throw new Error('Ordre de production non trouvé');
    }

    if (order.Status !== 'planned') {
      throw new Error('Seuls les ordres planifiés peuvent être démarrés');
    }

    // Vérifier la disponibilité des ingrédients
    for (const consumption of order.IngredientConsumptions) {
      const ingredient = await ingredientService.getById(consumption.IngredientId);
      if (!ingredient) {
        throw new Error(`Ingrédient non trouvé: ${consumption.IngredientName}`);
      }

      if (ingredient.CurrentStock < consumption.PlannedQuantity) {
        throw new Error(
          `Stock insuffisant pour ${consumption.IngredientName}: ${ingredient.CurrentStock} ${ingredient.Unit} disponible(s), ${consumption.PlannedQuantity} ${consumption.Unit} requis`
        );
      }
    }

    return await this.update(productionOrderId, {
      status: 'in_progress',
      actualStartDate: new Date().toISOString(),
    });
  }

  /**
   * Consomme les ingrédients (sortie de stock)
   */
  async consumeIngredients(
    productionOrderId: string,
    input: ConsumeIngredientsInput
  ): Promise<ProductionOrder> {
    const order = await this.getById(productionOrderId);
    if (!order) {
      throw new Error('Ordre de production non trouvé');
    }

    if (order.Status !== 'in_progress') {
      throw new Error('Seuls les ordres en cours peuvent consommer des ingrédients');
    }

    let totalCost = 0;

    for (const consumptionInput of input.ingredients) {
      // Trouver la consommation correspondante
      const consumption = order.IngredientConsumptions.find(
        (c) => c.IngredientId === consumptionInput.ingredientId
      );

      if (!consumption) {
        throw new Error(`Ingrédient non prévu dans cette recette: ${consumptionInput.ingredientId}`);
      }

      // Diminuer le stock de l'ingrédient
      await ingredientService.decreaseStock(
        consumptionInput.ingredientId,
        consumptionInput.actualQuantity
      );

      // Mettre à jour la consommation
      const variance =
        ((consumptionInput.actualQuantity - consumption.PlannedQuantity) / consumption.PlannedQuantity) *
        100;

      const consumptionCost = consumptionInput.actualQuantity * consumption.UnitCost;
      totalCost += consumptionCost;

      const records = await airtableClient.list<IngredientConsumption>('IngredientConsumption', {
        filterByFormula: `{ConsumptionId} = '${consumption.ConsumptionId}'`,
      });

      if (records.length > 0) {
        const recordId = (records[0] as any)._recordId;
        await airtableClient.update<IngredientConsumption>('IngredientConsumption', recordId, {
          ActualQuantity: consumptionInput.actualQuantity,
          TotalCost: consumptionCost,
          Variance: variance,
          ConsumedAt: new Date().toISOString(),
        });
      }
    }

    // Mettre à jour le coût total de l'ordre
    const orderRecords = await airtableClient.list<ProductionOrder>('ProductionOrder', {
      filterByFormula: `{ProductionOrderId} = '${productionOrderId}'`,
    });

    if (orderRecords.length > 0) {
      const recordId = (orderRecords[0] as any)._recordId;
      await airtableClient.update<ProductionOrder>('ProductionOrder', recordId, {
        TotalCost: order.TotalCost + totalCost,
      });
    }

    return await this.getById(productionOrderId);
  }

  /**
   * Crée un batch/lot de production
   */
  async createBatch(productionOrderId: string, input: CreateBatchInput): Promise<ProductionBatch> {
    const order = await this.getById(productionOrderId);
    if (!order) {
      throw new Error('Ordre de production non trouvé');
    }

    if (order.Status !== 'in_progress') {
      throw new Error('Seuls les ordres en cours peuvent créer des lots');
    }

    const batchNumber = await this.generateBatchNumber(order.WorkspaceId);

    const batch: Partial<ProductionBatch> = {
      BatchId: uuidv4(),
      BatchNumber: batchNumber,
      ProductionOrderId: productionOrderId,
      ProductId: order.ProductId,
      ProductName: order.ProductName,
      QuantityProduced: input.quantityProduced,
      QuantityDefective: input.quantityDefective,
      QuantityGood: input.quantityProduced - input.quantityDefective,
      Unit: order.Unit,
      QualityScore: input.qualityScore,
      ExpiryDate: input.expiryDate,
      ProductionDate: new Date().toISOString(),
      Notes: input.notes,
      WorkspaceId: order.WorkspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdBatch = await airtableClient.create<ProductionBatch>('ProductionBatch', batch);

    // Mettre à jour la quantité produite de l'ordre
    const newProducedQty = order.ProducedQuantity + (input.quantityProduced - input.quantityDefective);
    const yieldRate = (newProducedQty / order.PlannedQuantity) * 100;

    const orderRecords = await airtableClient.list<ProductionOrder>('ProductionOrder', {
      filterByFormula: `{ProductionOrderId} = '${productionOrderId}'`,
    });

    if (orderRecords.length > 0) {
      const recordId = (orderRecords[0] as any)._recordId;
      await airtableClient.update<ProductionOrder>('ProductionOrder', recordId, {
        ProducedQuantity: newProducedQty,
        YieldRate: yieldRate,
      });
    }

    // Intégration avec le module Stock: Entrée automatique des produits finis
    if (order.DestinationWarehouseId && batch.QuantityGood > 0) {
      const costPerUnit = order.TotalCost / newProducedQty;

      await stockService.upsertStockItem({
        productId: order.ProductId,
        warehouseId: order.DestinationWarehouseId,
        quantity: batch.QuantityGood,
        minimumStock: 0, // À définir selon les besoins
        unitCost: costPerUnit,
        workspaceId: order.WorkspaceId,
      });
    }

    return createdBatch;
  }

  /**
   * Génère le prochain numéro de batch/lot
   */
  private async generateBatchNumber(workspaceId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `LOT-${year}${month}`;

    const existingBatches = await airtableClient.list<ProductionBatch>('ProductionBatch', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', SEARCH('${prefix}', {BatchNumber}) = 1)`,
      sort: [{ field: 'BatchNumber', direction: 'desc' }],
    });

    let nextNumber = 1;
    if (existingBatches.length > 0) {
      const lastNumber = existingBatches[0].BatchNumber;
      const match = lastNumber.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Complète un ordre de production
   */
  async complete(productionOrderId: string): Promise<ProductionOrder> {
    const order = await this.getById(productionOrderId);
    if (!order) {
      throw new Error('Ordre de production non trouvé');
    }

    if (order.Status !== 'in_progress') {
      throw new Error('Seuls les ordres en cours peuvent être complétés');
    }

    if (order.Batches.length === 0) {
      throw new Error('Au moins un lot doit être créé avant de compléter l\'ordre');
    }

    return await this.update(productionOrderId, {
      status: 'completed',
      actualEndDate: new Date().toISOString(),
    });
  }

  /**
   * Annule un ordre de production
   */
  async cancel(productionOrderId: string, reason?: string): Promise<ProductionOrder> {
    const order = await this.getById(productionOrderId);
    if (!order) {
      throw new Error('Ordre de production non trouvé');
    }

    if (order.Status === 'completed') {
      throw new Error('Un ordre complété ne peut pas être annulé');
    }

    return await this.update(productionOrderId, {
      status: 'cancelled',
      notes: reason ? `${order.Notes || ''}\nAnnulé: ${reason}` : order.Notes,
    });
  }

  /**
   * Statistiques des ordres de production
   */
  async getStatistics(
    workspaceId: string,
    dateRange?: { from: string; to: string }
  ): Promise<{
    totalOrders: number;
    byStatus: Record<ProductionOrderStatus, number>;
    totalProducedQuantity: number;
    averageYieldRate: number;
    totalCost: number;
    onTimeDelivery: number;
  }> {
    let orders = await this.list(workspaceId);

    if (dateRange) {
      orders = orders.filter(
        (o) => o.PlannedStartDate >= dateRange.from && o.PlannedStartDate <= dateRange.to
      );
    }

    const byStatus: Record<ProductionOrderStatus, number> = {
      draft: 0,
      planned: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    let totalProducedQuantity = 0;
    let totalYieldRate = 0;
    let totalCost = 0;
    let onTimeCount = 0;
    let completedCount = 0;

    for (const order of orders) {
      byStatus[order.Status]++;
      totalProducedQuantity += order.ProducedQuantity;
      totalYieldRate += order.YieldRate;
      totalCost += order.TotalCost;

      if (order.Status === 'completed') {
        completedCount++;
        if (order.ActualEndDate && order.ActualEndDate <= order.PlannedEndDate) {
          onTimeCount++;
        }
      }
    }

    return {
      totalOrders: orders.length,
      byStatus,
      totalProducedQuantity,
      averageYieldRate: orders.length > 0 ? totalYieldRate / orders.length : 0,
      totalCost,
      onTimeDelivery: completedCount > 0 ? (onTimeCount / completedCount) * 100 : 0,
    };
  }
}
