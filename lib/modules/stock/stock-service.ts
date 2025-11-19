/**
 * Service - Gestion des Stocks
 * Module Stocks & Mouvements
 */

import { AirtableClient } from '@/lib/airtable/client';
import { StockItem, StockAlert, Product, Warehouse, StockStatistics } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
    const existing = await airtableClient.list<StockItem>('StockItem', {
      filterByFormula: `AND({ProductId} = '${input.productId}', {WarehouseId} = '${input.warehouseId}')`,
    });

    if (existing.length > 0) {
      // Update existing
      const currentItem = existing[0];
      const newQuantity = currentItem.Quantity + input.quantity;
      const newTotalValue = newQuantity * input.unitCost;

      const updated = await airtableClient.update<StockItem>(
        'StockItem',
        (existing[0] as any)._recordId,
        {
          Quantity: newQuantity,
          UnitCost: input.unitCost,
          TotalValue: newTotalValue,
          LastRestockDate: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
        }
      );
      if (!updated) {
        throw new Error('Failed to update stock item - Airtable not configured');
      }

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

      const created = await airtableClient.create<StockItem>('StockItem', stockItem);
      if (!created) {
        throw new Error('Failed to create stock item - Airtable not configured');
      }
      await this.checkAndCreateAlert(created);
      return created;
    }
  }

  /**
   * Récupère un article en stock par ID
   */
  async getById(stockItemId: string): Promise<StockItem | null> {
    const items = await airtableClient.list<StockItem>('StockItem', {
      filterByFormula: `{StockItemId} = '${stockItemId}'`,
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
    const items = await airtableClient.list<StockItem>('StockItem', {
      filterByFormula: `AND({ProductId} = '${productId}', {WarehouseId} = '${warehouseId}')`,
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
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.warehouseId) {
      filterFormulas.push(`{WarehouseId} = '${filters.warehouseId}'`);
    }

    if (filters.productId) {
      filterFormulas.push(`{ProductId} = '${filters.productId}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    let items = await airtableClient.list<StockItem>('StockItem', {
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
    const items = await airtableClient.list<StockItem>('StockItem', {
      filterByFormula: `{StockItemId} = '${stockItemId}'`,
    });

    if (items.length === 0) {
      throw new Error('Article en stock non trouvé');
    }

    const currentItem = items[0];
    const updates: Partial<StockItem> = {
      ...input,
      UpdatedAt: new Date().toISOString(),
    };

    // Recalculate total value if quantity or unit cost changed
    const newQuantity = input.quantity !== undefined ? input.quantity : currentItem.Quantity;
    const newUnitCost = input.unitCost !== undefined ? input.unitCost : currentItem.UnitCost;
    updates.TotalValue = newQuantity * newUnitCost;

    const updated = await airtableClient.update<StockItem>(
      'StockItem',
      (items[0] as any)._recordId,
      updates
    );
    if (!updated) {
      throw new Error('Failed to update stock item - Airtable not configured');
    }

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

      const items = await airtableClient.list<StockItem>('StockItem', {
        filterByFormula: `{StockItemId} = '${existingStock.StockItemId}'`,
      });

      if (items.length === 0) {
        throw new Error('Article en stock non trouvé');
      }

      const updated = await airtableClient.update<StockItem>(
        'StockItem',
        (items[0] as any)._recordId,
        {
          Quantity: newQuantity,
          UnitCost: newUnitCost,
          TotalValue: newQuantity * newUnitCost,
          LastRestockDate: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
        }
      );
      if (!updated) {
        throw new Error('Failed to update stock item - Airtable not configured');
      }

      await this.checkAndCreateAlert(updated);
      return updated;
    } else {
      // Create new stock item
      if (unitCost === undefined) {
        throw new Error('Le coût unitaire est requis pour créer un nouvel article en stock');
      }

      // Get product to set default minimums
      const products = await airtableClient.list<Product>('Product', {
        filterByFormula: `{ProductId} = '${productId}'`,
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

      const created = await airtableClient.create<StockItem>('StockItem', stockItem);
      if (!created) {
        throw new Error('Failed to create stock item - Airtable not configured');
      }
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

    const items = await airtableClient.list<StockItem>('StockItem', {
      filterByFormula: `{StockItemId} = '${existingStock.StockItemId}'`,
    });

    if (items.length === 0) {
      throw new Error('Article en stock non trouvé');
    }

    const updated = await airtableClient.update<StockItem>(
      'StockItem',
      (items[0] as any)._recordId,
      {
        Quantity: newQuantity,
        TotalValue: newQuantity * existingStock.UnitCost,
        UpdatedAt: new Date().toISOString(),
      }
    );
    if (!updated) {
      throw new Error('Failed to update stock item - Airtable not configured');
    }

    await this.checkAndCreateAlert(updated);
    return updated;
  }

  /**
   * Vérifie et crée des alertes si nécessaire
   */
  async checkAndCreateAlert(stockItem: StockItem): Promise<void> {
    // Check if alert already exists and is not resolved
    const existingAlerts = await airtableClient.list<StockAlert>('StockAlert', {
      filterByFormula: `AND({StockItemId} = '${stockItem.StockItemId}', {IsResolved} = 0)`,
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

        const createdAlert = await airtableClient.create<StockAlert>('StockAlert', alert);
        if (!createdAlert) {
          throw new Error('Failed to create stock alert - Airtable not configured');
        }
      }
    } else {
      // Resolve existing alerts if stock is back to normal
      for (const alert of existingAlerts) {
        await airtableClient.update<StockAlert>(
          'StockAlert',
          (alert as any)._recordId,
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
      `AND({WorkspaceId} = '${workspaceId}', {IsResolved} = 0)`,
    ];

    if (filters.alertType) {
      filterFormulas.push(`{AlertType} = '${filters.alertType}'`);
    }

    if (filters.warehouseId) {
      filterFormulas.push(`{WarehouseId} = '${filters.warehouseId}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await airtableClient.list<StockAlert>('StockAlert', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  /**
   * Récupère les statistiques des stocks
   */
  async getStatistics(workspaceId: string): Promise<StockStatistics> {
    const items = await this.list(workspaceId);
    const warehouses = await airtableClient.list<Warehouse>('Warehouse', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });
    const products = await airtableClient.list<Product>('Product', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
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
