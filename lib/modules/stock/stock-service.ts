/**
 * Service - Gestion des Stocks
 *
 * Un stock_item est rattaché soit à un warehouse, soit à un outlet (mutuellement exclusifs).
 * Les warehouses sont des dépôts centraux. Les outlets sont les points de vente.
 * Les transferts (warehouse↔outlet, outlet↔outlet) alimentent les stocks d'outlet.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { StockItem, StockAlert, Product, Warehouse, StockStatistics } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();

export interface UpsertStockItemInput {
  workspaceId: string;
  productId: string;
  warehouseId?: string;
  outletId?: string;
  quantity: number;
  minimumStock?: number;
  maximumStock?: number;
  unitCost: number;
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

export interface StockListFilters {
  warehouseId?: string;
  outletId?: string;
  productId?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
}

export class StockService {
  /** Crée ou met à jour un article en stock (warehouse OU outlet, exclusif). */
  async upsertStockItem(input: UpsertStockItemInput): Promise<StockItem> {
    if (!input.warehouseId === !input.outletId) {
      throw new Error('Un stock doit être rattaché soit à un entrepôt, soit à un point de vente (exclusif).');
    }

    const existing = input.warehouseId
      ? await this.getByProductAndWarehouse(input.productId, input.warehouseId)
      : await this.getByProductAndOutlet(input.productId, input.outletId!);

    if (existing) {
      // Increment atomique : la somme se fait en SQL. Évite la race
      // « deux upsert concurrents lisent quantity=10, calculent chacun
      // 10+5 et écrivent 15 » qui ferait perdre une livraison.
      const r = await db.query(
        `UPDATE stock_items
         SET quantity = quantity + $2,
             unit_cost = $3,
             total_value = (quantity + $2) * $3,
             last_restock_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [existing.id, input.quantity, input.unitCost]
      );
      const updated = mapStockRow(r.rows[0]);
      await this.checkAndCreateAlert(updated);
      return updated;
    }

    const r = await db.query(
      `INSERT INTO stock_items
        (stock_item_id, product_id, warehouse_id, outlet_id,
         quantity, minimum_stock, maximum_stock, unit_cost, total_value,
         last_restock_date, workspace_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CURRENT_TIMESTAMP, $10)
       RETURNING *`,
      [
        uuidv4(),
        input.productId,
        input.warehouseId ?? null,
        input.outletId ?? null,
        input.quantity,
        input.minimumStock ?? 0,
        input.maximumStock ?? null,
        input.unitCost,
        input.quantity * input.unitCost,
        input.workspaceId,
      ]
    );
    const created = mapStockRow(r.rows[0]);
    await this.checkAndCreateAlert(created);
    return created;
  }

  async getById(stockItemId: string): Promise<StockItem | null> {
    const r = await db.query(
      `SELECT * FROM stock_items WHERE id::text = $1 OR stock_item_id = $1 LIMIT 1`,
      [stockItemId]
    );
    return r.rows.length > 0 ? mapStockRow(r.rows[0]) : null;
  }

  async getByProductAndWarehouse(productId: string, warehouseId: string): Promise<StockItem | null> {
    const r = await db.query(
      `SELECT * FROM stock_items WHERE product_id = $1 AND warehouse_id = $2 LIMIT 1`,
      [productId, warehouseId]
    );
    return r.rows.length > 0 ? mapStockRow(r.rows[0]) : null;
  }

  async getByProductAndOutlet(productId: string, outletId: string): Promise<StockItem | null> {
    const r = await db.query(
      `SELECT * FROM stock_items WHERE product_id = $1 AND outlet_id = $2 LIMIT 1`,
      [productId, outletId]
    );
    return r.rows.length > 0 ? mapStockRow(r.rows[0]) : null;
  }

  async list(workspaceId: string, filters: StockListFilters = {}): Promise<StockItem[]> {
    const params: any[] = [workspaceId];
    let sql = `SELECT * FROM stock_items WHERE workspace_id = $1`;
    if (filters.warehouseId) { params.push(filters.warehouseId); sql += ` AND warehouse_id = $${params.length}`; }
    if (filters.outletId)    { params.push(filters.outletId);    sql += ` AND outlet_id = $${params.length}`; }
    if (filters.productId)   { params.push(filters.productId);   sql += ` AND product_id = $${params.length}`; }
    if (filters.lowStock)    { sql += ` AND quantity > 0 AND quantity <= minimum_stock`; }
    if (filters.outOfStock)  { sql += ` AND quantity = 0`; }
    sql += ` ORDER BY created_at DESC`;
    const r = await db.query(sql, params);
    return r.rows.map(mapStockRow);
  }

  async update(stockItemId: string, input: UpdateStockItemInput): Promise<StockItem> {
    const existing = await this.getById(stockItemId);
    if (!existing) throw new Error('Article en stock non trouvé');

    const newQuantity = input.quantity !== undefined ? input.quantity : existing.Quantity;
    const newUnitCost = input.unitCost !== undefined ? input.unitCost : existing.UnitCost;
    const newTotalValue = newQuantity * newUnitCost;

    // Casts explicites : pg ne peut pas inférer le type d'un paramètre
    // null non casté dans COALESCE — symptôme « could not determine
    // data type of parameter ». minimum/maximum_stock sont DECIMAL(10,3).
    const r = await db.query(
      `UPDATE stock_items
       SET quantity = $2,
           minimum_stock = COALESCE($3::numeric, minimum_stock),
           maximum_stock = COALESCE($4::numeric, maximum_stock),
           unit_cost = $5,
           total_value = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [
        existing.id,
        newQuantity,
        input.minimumStock ?? null,
        input.maximumStock ?? null,
        newUnitCost,
        newTotalValue,
      ]
    );
    const updated = mapStockRow(r.rows[0]);
    await this.checkAndCreateAlert(updated);
    return updated;
  }

  async adjustStock(input: AdjustStockInput): Promise<StockItem> {
    const item = await this.getById(input.stockItemId);
    if (!item) throw new Error('Article en stock non trouvé');

    let newQuantity: number;
    switch (input.operation) {
      case 'add':      newQuantity = item.Quantity + input.quantity; break;
      case 'subtract':
        newQuantity = item.Quantity - input.quantity;
        if (newQuantity < 0) throw new Error('La quantité ne peut pas être négative');
        break;
      case 'set':      newQuantity = input.quantity; break;
      default: throw new Error('Opération invalide');
    }
    return await this.update(item.id!, { quantity: newQuantity, unitCost: input.unitCost });
  }

  // ===== Helpers utilisés par les ventes / mouvements =====

  /** Augmente le stock pour (produit, outlet). Crée la ligne si elle n'existe pas. */
  async increaseStockOutlet(productId: string, outletId: string, workspaceId: string, quantity: number, unitCost: number): Promise<StockItem> {
    return this.upsertStockItem({
      workspaceId, productId, outletId, quantity, unitCost,
    });
  }

  /** Augmente le stock pour (produit, warehouse). */
  async increaseStockWarehouse(productId: string, warehouseId: string, workspaceId: string, quantity: number, unitCost: number): Promise<StockItem> {
    return this.upsertStockItem({
      workspaceId, productId, warehouseId, quantity, unitCost,
    });
  }

  /** Décrément stock outlet (vente). Throw si insuffisant. */
  async decreaseStockOutlet(productId: string, outletId: string, quantity: number): Promise<StockItem> {
    const existing = await this.getByProductAndOutlet(productId, outletId);
    if (!existing) throw new Error(`Aucun stock pour ce produit sur ce point de vente`);
    if (existing.Quantity < quantity) {
      throw new Error(`Stock insuffisant : ${existing.Quantity} disponible(s), ${quantity} demandé(s)`);
    }
    return this.update(existing.id!, { quantity: existing.Quantity - quantity });
  }

  /** Décrément stock entrepôt. */
  async decreaseStockWarehouse(productId: string, warehouseId: string, quantity: number): Promise<StockItem> {
    const existing = await this.getByProductAndWarehouse(productId, warehouseId);
    if (!existing) throw new Error(`Aucun stock pour ce produit dans cet entrepôt`);
    if (existing.Quantity < quantity) {
      throw new Error(`Stock insuffisant : ${existing.Quantity} disponible(s), ${quantity} demandé(s)`);
    }
    return this.update(existing.id!, { quantity: existing.Quantity - quantity });
  }

  /** @deprecated alias rétro-compat — utilise increaseStockWarehouse explicitement. */
  async increaseStock(productId: string, warehouseId: string, quantity: number, unitCost?: number): Promise<StockItem> {
    if (unitCost === undefined) {
      const existing = await this.getByProductAndWarehouse(productId, warehouseId);
      if (!existing) throw new Error('Coût unitaire requis pour créer un nouvel article en stock');
      unitCost = existing.UnitCost;
    }
    return this.increaseStockWarehouse(productId, warehouseId, await this.workspaceIdForWarehouse(warehouseId), quantity, unitCost);
  }

  /** @deprecated alias rétro-compat — utilise decreaseStockWarehouse explicitement. */
  async decreaseStock(productId: string, warehouseId: string, quantity: number): Promise<StockItem> {
    return this.decreaseStockWarehouse(productId, warehouseId, quantity);
  }

  private async workspaceIdForWarehouse(warehouseId: string): Promise<string> {
    const r = await db.query(`SELECT workspace_id FROM warehouses WHERE id = $1`, [warehouseId]);
    if (r.rows.length === 0) throw new Error('Entrepôt introuvable');
    return r.rows[0].workspace_id;
  }

  // ===== Alertes =====

  async checkAndCreateAlert(stockItem: StockItem): Promise<void> {
    const existingAlerts = await db.query(
      `SELECT * FROM stock_alerts WHERE stock_item_id = $1 AND is_resolved = false`,
      [stockItem.id]
    );

    let alertType: 'low_stock' | 'out_of_stock' | 'overstock' | null = null;
    let threshold = 0;
    if (stockItem.Quantity === 0) { alertType = 'out_of_stock'; threshold = 0; }
    else if (stockItem.Quantity <= stockItem.MinimumStock) { alertType = 'low_stock'; threshold = stockItem.MinimumStock; }
    else if (stockItem.MaximumStock && stockItem.Quantity > stockItem.MaximumStock) {
      alertType = 'overstock'; threshold = stockItem.MaximumStock;
    }

    if (alertType) {
      if (existingAlerts.rows.length === 0) {
        await db.query(
          `INSERT INTO stock_alerts
            (alert_id, stock_item_id, product_id, warehouse_id, outlet_id,
             alert_type, current_quantity, threshold_quantity, workspace_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            uuidv4(), stockItem.id, stockItem.ProductId,
            stockItem.WarehouseId ?? null, stockItem.OutletId ?? null,
            alertType, stockItem.Quantity, threshold, stockItem.WorkspaceId,
          ]
        );
      }
    } else {
      // Résoudre les alertes existantes si stock revenu à la normale
      for (const alert of existingAlerts.rows) {
        await db.query(
          `UPDATE stock_alerts SET is_resolved = true, resolved_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [alert.id]
        );
      }
    }
  }

  async getActiveAlerts(workspaceId: string, filters: { alertType?: string; warehouseId?: string; outletId?: string } = {}): Promise<StockAlert[]> {
    const params: any[] = [workspaceId];
    let sql = `SELECT * FROM stock_alerts WHERE workspace_id = $1 AND is_resolved = false`;
    if (filters.alertType)   { params.push(filters.alertType);   sql += ` AND alert_type = $${params.length}`; }
    if (filters.warehouseId) { params.push(filters.warehouseId); sql += ` AND warehouse_id = $${params.length}`; }
    if (filters.outletId)    { params.push(filters.outletId);    sql += ` AND outlet_id = $${params.length}`; }
    sql += ` ORDER BY created_at DESC`;
    const r = await db.query(sql, params);
    return r.rows.map(mapAlertRow);
  }

  // ===== Statistiques =====

  async getStatistics(workspaceId: string): Promise<StockStatistics> {
    const items = await this.list(workspaceId);
    const warehousesRes = await db.query(
      `SELECT * FROM warehouses WHERE workspace_id = $1`,
      [workspaceId]
    );
    const warehouses: Warehouse[] = warehousesRes.rows.map(mapWarehouseRow);
    const productsRes = await db.query(
      `SELECT * FROM products WHERE workspace_id = $1`,
      [workspaceId]
    );
    const products: Product[] = productsRes.rows.map(mapProductRow);

    const totalValue = items.reduce((s, i) => s + Number(i.TotalValue || 0), 0);
    const lowStockItems = items.filter(i => i.Quantity > 0 && i.Quantity <= i.MinimumStock).length;
    const outOfStockItems = items.filter(i => i.Quantity === 0).length;

    const productMap = new Map<string, { totalQuantity: number; totalValue: number; warehouses: Set<string> }>();
    for (const item of items) {
      const key = item.ProductId;
      const e = productMap.get(key) ?? { totalQuantity: 0, totalValue: 0, warehouses: new Set<string>() };
      e.totalQuantity += Number(item.Quantity);
      e.totalValue += Number(item.TotalValue);
      if (item.WarehouseId) e.warehouses.add(item.WarehouseId);
      if (item.OutletId)    e.warehouses.add(item.OutletId);
      productMap.set(key, e);
    }
    const topProducts = Array.from(productMap.entries())
      .map(([productId, s]) => {
        const product = products.find((p: any) => p.ProductId === productId || p.id === productId);
        return {
          productId,
          productName: product?.Name || 'Produit inconnu',
          totalQuantity: s.totalQuantity,
          totalValue: s.totalValue,
          warehouses: s.warehouses.size,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    return {
      totalItems: items.length,
      totalValue,
      lowStockItems,
      outOfStockItems,
      warehousesCount: warehouses.length,
      movementsCount: 0,
      topProducts,
      warehouseStats: [],
      movementsByType: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Mappers

function mapStockRow(r: any): StockItem {
  return {
    id: r.id,
    StockItemId: r.stock_item_id,
    ProductId: r.product_id,
    WarehouseId: r.warehouse_id ?? undefined,
    OutletId: r.outlet_id ?? undefined,
    Quantity: Number(r.quantity),
    MinimumStock: Number(r.minimum_stock),
    MaximumStock: r.maximum_stock !== null ? Number(r.maximum_stock) : undefined,
    UnitCost: Number(r.unit_cost),
    TotalValue: Number(r.total_value),
    LastRestockDate: r.last_restock_date ? (r.last_restock_date.toISOString?.() ?? r.last_restock_date) : undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

function mapAlertRow(r: any): StockAlert {
  return {
    id: r.id,
    AlertId: r.alert_id,
    StockItemId: r.stock_item_id,
    ProductId: r.product_id,
    WarehouseId: r.warehouse_id ?? undefined,
    OutletId: r.outlet_id ?? undefined,
    AlertType: r.alert_type,
    CurrentQuantity: Number(r.current_quantity),
    ThresholdQuantity: Number(r.threshold_quantity),
    IsResolved: r.is_resolved,
    ResolvedAt: r.resolved_at ? (r.resolved_at.toISOString?.() ?? r.resolved_at) : undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}

function mapWarehouseRow(r: any): Warehouse {
  return {
    id: r.id,
    WarehouseId: r.warehouse_id,
    Name: r.name,
    Code: r.code,
    Location: r.location ?? undefined,
    Address: r.address ?? undefined,
    ManagerId: r.manager_id ?? undefined,
    IsActive: r.is_active,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  } as Warehouse;
}

function mapProductRow(r: any): Product {
  return {
    id: r.id,
    ProductId: r.product_id,
    Code: r.code,
    Name: r.name,
    Description: r.description ?? undefined,
    Category: r.category ?? undefined,
    UnitPrice: Number(r.unit_price ?? 0),
    Currency: r.currency,
    IsActive: r.is_active,
    ImageUrl: r.image_url ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  } as Product;
}
