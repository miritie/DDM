/**
 * Service - Gestion des Stocks
 * Module Stocks & Mouvements
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { StockItem, StockAlert, Product, Warehouse, StockStatistics } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateStockItemInput {
  productId: string;
  warehouseId: string;
  quantity: number;
  minimumStock: number;
  maximumStock?: number;
  unitCost: number;
  workspaceId: string;
}

export interface UpdateStockItemInput {
  quantity?: number;
  minimumStock?: number;
  maximumStock?: number;
  unitCost?: number;
}

export interface AdjustStockInput {
  stockItemId: string;
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
  unitCost?: number;
}

/**
 * Service de gestion des stocks
 */
export class StockService {
  /**
   * Crée ou met à jour un article en stock
   */
  async upsertStockItem(input: CreateStockItemInput): Promise<StockItem> {
    // Check if stock item already exists
    const existing = await postgresClient.list<StockItem>('stock_items', {
      filterByFormula: `AND({product_id} = '${input.productId}', {warehouse_id} = '${input.warehouseId}')`,
    });

    if (existing.length > 0) {
      // Update existing
      const currentItem = existing[0];
      const newQuantity = currentItem.Quantity + input.quantity;
      const newTotalValue = newQuantity * input.unitCost;

      const updated = await postgresClient.update<StockItem>(
        'stock_items',
        existing[0].id!,
        {
          Quantity: newQuantity,
          UnitCost: input.unitCost,
          TotalValue: newTotalValue,
          LastRestockDate: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
        }
      );

      await this.checkAndCreateAlert(updated);
      return updated;
    } else {
      // Create new
      const stockItem: Partial<StockItem> = {
        StockItemId: uuidv4(),
        ProductId: input.productId,
        WarehouseId: input.warehouseId,
        Quantity: input.quantity,
        MinimumStock: input.minimumStock,
        MaximumStock: input.maximumStock,
        UnitCost: input.unitCost,
        TotalValue: input.quantity * input.unitCost,
        LastRestockDate: new Date().toISOString(),
        WorkspaceId: input.workspaceId,
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      };

      const created = await postgresClient.create<StockItem>('stock_items', stockItem);
      await this.checkAndCreateAlert(created);
      return created;
    }
  }

  /**
   * Récupère un article en stock par ID
   */
  async getById(stockItemId: string): Promise<StockItem | null> {
    const items = await postgresClient.list<StockItem>('stock_items', {
      filterByFormula: `{stock_item_id} = '${stockItemId}'`,
    });

    return items.length > 0 ? items[0] : null;
  }

  /**
   * Récupère un article en stock par produit et entrepôt
   */
  async getByProductAndWarehouse(
    productId: string,
    warehouseId: string
  ): Promise<StockItem | null> {
    const items = await postgresClient.list<StockItem>('stock_items', {
      filterByFormula: `AND({product_id} = '${productId}', {warehouse_id} = '${warehouseId}')`,
    });

    return items.length > 0 ? items[0] : null;
  }

  /**
   * Liste les articles en stock d'un workspace
   */
  async list(
    workspaceId: string,
    filters: {
      warehouseId?: string;
      productId?: string;
      lowStock?: boolean;
      outOfStock?: boolean;
    } = {}
  ): Promise<StockItem[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.warehouseId) {
      filterFormulas.push(`{warehouse_id} = '${filters.warehouseId}'`);
    }

    if (filters.productId) {
      filterFormulas.push(`{product_id} = '${filters.productId}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    let items = await postgresClient.list<StockItem>('stock_items', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });

    // Apply client-side filters
    if (filters.lowStock) {
      items = items.filter(
        (item) => item.Quantity > 0 && item.Quantity <= item.MinimumStock
      );
    }

    if (filters.outOfStock) {
      items = items.filter((item) => item.Quantity === 0);
    }

    return items;
  }

  /**
   * Met à jour un article en stock
   */
  async update(stockItemId: string, input: UpdateStockItemInput): Promise<StockItem> {
    const items = await postgresClient.list<StockItem>('stock_items', {
      filterByFormula: `{stock_item_id} = '${stockItemId}'`,
    });

    if (items.length === 0) {
      throw new Error('Article en stock non trouvé');
    }

    const currentItem = items[0];
    const updates: Partial<StockItem> = {
      Quantity: input.quantity,
      MinimumStock: input.minimumStock,
      MaximumStock: input.maximumStock,
      UnitCost: input.unitCost,
      UpdatedAt: new Date().toISOString(),
    };

    // Recalculate total value if quantity or unit cost changed
    const newQuantity = input.quantity !== undefined ? input.quantity : currentItem.Quantity;
    const newUnitCost = input.unitCost !== undefined ? input.unitCost : currentItem.UnitCost;
    updates.TotalValue = newQuantity * newUnitCost;

    const updated = await postgresClient.update<StockItem>(
      'stock_items',
      items[0].id!,
      updates
    );

    await this.checkAndCreateAlert(updated);
    return updated;
  }

  /**
   * Ajuste la quantité en stock
   */
  async adjustStock(input: AdjustStockInput): Promise<StockItem> {
    const item = await this.getById(input.stockItemId);
    if (!item) {
      throw new Error('Article en stock non trouvé');
    }

    let newQuantity: number;
    switch (input.operation) {
      case 'add':
        newQuantity = item.Quantity + input.quantity;
        break;
      case 'subtract':
        newQuantity = item.Quantity - input.quantity;
        if (newQuantity < 0) {
          throw new Error('La quantité ne peut pas être négative');
        }
        break;
      case 'set':
        newQuantity = input.quantity;
        break;
      default:
        throw new Error('Opération invalide');
    }

    return await this.update(input.stockItemId, {
      quantity: newQuantity,
      unitCost: input.unitCost,
    });
  }

  /**
   * Augmente le stock (entrée de production)
   */
  async increaseStock(
    productId: string,
    warehouseId: string,
    quantity: number,
    unitCost?: number
  ): Promise<StockItem> {
    const existingStock = await this.getByProductAndWarehouse(productId, warehouseId);

    if (existingStock) {
      // Update existing stock
      const newQuantity = existingStock.Quantity + quantity;
      const newUnitCost = unitCost !== undefined ? unitCost : existingStock.UnitCost;

      const items = await postgresClient.list<StockItem>('stock_items', {
        filterByFormula: `{stock_item_id} = '${existingStock.StockItemId}'`,
      });

      if (items.length === 0) {
        throw new Error('Article en stock non trouvé');
      }

      const updated = await postgresClient.update<StockItem>(
        'stock_items',
        items[0].id!,
        {
          Quantity: newQuantity,
          UnitCost: newUnitCost,
          TotalValue: newQuantity * newUnitCost,
          LastRestockDate: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
        }
      );

      await this.checkAndCreateAlert(updated);
      return updated;
    } else {
      // Create new stock item
      if (unitCost === undefined) {
        throw new Error('Le coût unitaire est requis pour créer un nouvel article en stock');
      }

      // Get product to set default minimums
      const products = await postgresClient.list<Product>('products', {
        filterByFormula: `{product_id} = '${productId}'`,
      });

      if (products.length === 0) {
        throw new Error('Produit non trouvé');
      }

      const product = products[0];

      const stockItem: Partial<StockItem> = {
        StockItemId: uuidv4(),
        ProductId: productId,
        WarehouseId: warehouseId,
        Quantity: quantity,
        MinimumStock: 10, // Default minimum
        MaximumStock: undefined,
        UnitCost: unitCost,
        TotalValue: quantity * unitCost,
        LastRestockDate: new Date().toISOString(),
        WorkspaceId: product.WorkspaceId,
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      };

      const created = await postgresClient.create<StockItem>('stock_items', stockItem);
      await this.checkAndCreateAlert(created);
      return created;
    }
  }

  /**
   * Diminue le stock (sortie pour vente/distribution)
   */
  async decreaseStock(
    productId: string,
    warehouseId: string,
    quantity: number
  ): Promise<StockItem> {
    const existingStock = await this.getByProductAndWarehouse(productId, warehouseId);

    if (!existingStock) {
      throw new Error('Article en stock non trouvé');
    }

    if (existingStock.Quantity < quantity) {
      throw new Error(
        `Stock insuffisant: ${existingStock.Quantity} disponible(s), ${quantity} demandé(s)`
      );
    }

    const newQuantity = existingStock.Quantity - quantity;

    const items = await postgresClient.list<StockItem>('stock_items', {
      filterByFormula: `{stock_item_id} = '${existingStock.StockItemId}'`,
    });

    if (items.length === 0) {
      throw new Error('Article en stock non trouvé');
    }

    const updated = await postgresClient.update<StockItem>(
      'stock_items',
      items[0].id!,
      {
        Quantity: newQuantity,
        TotalValue: newQuantity * existingStock.UnitCost,
        UpdatedAt: new Date().toISOString(),
      }
    );

    await this.checkAndCreateAlert(updated);
    return updated;
  }

  /**
   * Vérifie et crée des alertes si nécessaire
   */
  async checkAndCreateAlert(stockItem: StockItem): Promise<void> {
    // Check if alert already exists and is not resolved
    const existingAlerts = await postgresClient.list<StockAlert>('stock_alerts', {
      filterByFormula: `AND({stock_item_id} = '${stockItem.StockItemId}', {is_resolved} = 0)`,
    });

    let alertType: 'low_stock' | 'out_of_stock' | 'overstock' | null = null;
    let thresholdQuantity = 0;

    if (stockItem.Quantity === 0) {
      alertType = 'out_of_stock';
      thresholdQuantity = 0;
    } else if (stockItem.Quantity <= stockItem.MinimumStock) {
      alertType = 'low_stock';
      thresholdQuantity = stockItem.MinimumStock;
    } else if (stockItem.MaximumStock && stockItem.Quantity > stockItem.MaximumStock) {
      alertType = 'overstock';
      thresholdQuantity = stockItem.MaximumStock;
    }

    if (alertType) {
      // Create alert if doesn't exist
      if (existingAlerts.length === 0) {
        const alert: Partial<StockAlert> = {
          AlertId: uuidv4(),
          StockItemId: stockItem.StockItemId,
          ProductId: stockItem.ProductId,
          WarehouseId: stockItem.WarehouseId,
          AlertType: alertType,
          CurrentQuantity: stockItem.Quantity,
          ThresholdQuantity: thresholdQuantity,
          IsResolved: false,
          WorkspaceId: stockItem.WorkspaceId,
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
        };

        await postgresClient.create<StockAlert>('stock_alerts', alert);
      }
    } else {
      // Resolve existing alerts if stock is back to normal
      for (const alert of existingAlerts) {
        await postgresClient.update<StockAlert>(
          'stock_alerts',
          alert.id!,
          {
            IsResolved: true,
            ResolvedAt: new Date().toISOString(),
            UpdatedAt: new Date().toISOString(),
          }
        );
      }
    }
  }

  /**
   * Récupère les alertes actives
   */
  async getActiveAlerts(
    workspaceId: string,
    filters: { alertType?: string; warehouseId?: string } = {}
  ): Promise<StockAlert[]> {
    const filterFormulas: string[] = [
      `AND({workspace_id} = '${workspaceId}', {is_resolved} = 0)`,
    ];

    if (filters.alertType) {
      filterFormulas.push(`{alert_type} = '${filters.alertType}'`);
    }

    if (filters.warehouseId) {
      filterFormulas.push(`{warehouse_id} = '${filters.warehouseId}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<StockAlert>('stock_alerts', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  /**
   * Récupère les statistiques des stocks
   */
  async getStatistics(workspaceId: string): Promise<StockStatistics> {
    const items = await this.list(workspaceId);
    const warehouses = await postgresClient.list<Warehouse>('warehouses', {
      filterByFormula: `{workspace_id} = '${workspaceId}'`,
    });
    const products = await postgresClient.list<Product>('products', {
      filterByFormula: `{workspace_id} = '${workspaceId}'`,
    });

    const totalValue = items.reduce((sum, item) => sum + item.TotalValue, 0);
    const lowStockItems = items.filter(
      (item) => item.Quantity > 0 && item.Quantity <= item.MinimumStock
    ).length;
    const outOfStockItems = items.filter((item) => item.Quantity === 0).length;

    // Calculate top products
    const productMap = new Map<
      string,
      { totalQuantity: number; totalValue: number; warehouses: Set<string> }
    >();

    for (const item of items) {
      const existing = productMap.get(item.ProductId) || {
        totalQuantity: 0,
        totalValue: 0,
        warehouses: new Set<string>(),
      };
      existing.totalQuantity += item.Quantity;
      existing.totalValue += item.TotalValue;
      existing.warehouses.add(item.WarehouseId);
      productMap.set(item.ProductId, existing);
    }

    const topProducts = Array.from(productMap.entries())
      .map(([productId, stats]) => {
        const product = products.find((p) => p.ProductId === productId);
        return {
          productId,
          productName: product?.Name || 'Produit inconnu',
          totalQuantity: stats.totalQuantity,
          totalValue: stats.totalValue,
          warehouses: stats.warehouses.size,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    // Calculate warehouse stats
    const warehouseMap = new Map<string, { itemsCount: number; totalValue: number }>();

    for (const item of items) {
      const existing = warehouseMap.get(item.WarehouseId) || {
        itemsCount: 0,
        totalValue: 0,
      };
      existing.itemsCount += 1;
      existing.totalValue += item.TotalValue;
      warehouseMap.set(item.WarehouseId, existing);
    }

    const warehouseStats = Array.from(warehouseMap.entries()).map(
      ([warehouseId, stats]) => {
        const warehouse = warehouses.find((w) => w.WarehouseId === warehouseId);
        return {
          warehouseId,
          warehouseName: warehouse?.Name || 'Entrepôt inconnu',
          itemsCount: stats.itemsCount,
          totalValue: stats.totalValue,
        };
      }
    );

    return {
      totalItems: items.length,
      totalValue,
      lowStockItems,
      outOfStockItems,
      warehousesCount: warehouses.length,
      movementsCount: 0, // Will be calculated by movement service
      topProducts,
      warehouseStats,
      movementsByType: [], // Will be calculated by movement service
    };
  }
}
