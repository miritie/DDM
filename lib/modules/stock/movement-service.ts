/**
 * Service - Gestion des Mouvements de Stock
 * Module Stocks & Mouvements
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { StockMovement, StockMovementType } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { StockService } from './stock-service';

const postgresClient = getPostgresClient();
const stockService = new StockService();

export interface CreateMovementInput {
  type: StockMovementType;
  productId: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  quantity: number;
  unitCost?: number;
  reason?: string;
  reference?: string;
  attachmentUrl?: string;
  processedById: string;
  workspaceId: string;
}

export interface ValidateMovementInput {
  movementId: string;
  validatedById: string;
}

export interface MovementFilters {
  type?: StockMovementType;
  productId?: string;
  warehouseId?: string;
  status?: 'pending' | 'validated' | 'cancelled';
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Service de gestion des mouvements de stock
 */
export class MovementService {
  /**
   * Génère un numéro de mouvement unique
   */
  async generateMovementNumber(
    workspaceId: string,
    type: StockMovementType
  ): Promise<string> {
    // Comptage SQL direct : le parser legacy filterByFormula ne supporte pas
    // YEAR(...) et retombait sur tout-le-workspace (bug documenté).
    const year = new Date().getFullYear();
    const r = await postgresClient.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
       FROM stock_movements
       WHERE workspace_id = $1
         AND type = $2
         AND EXTRACT(YEAR FROM processed_at) = $3`,
      [workspaceId, type, year]
    );
    const movements = { length: r.rows[0]?.n ?? 0 };

    const prefixes: Record<StockMovementType, string> = {
      entry: 'ENT',
      exit: 'EXT',
      transfer: 'TRF',
      adjustment: 'ADJ',
      return: 'RET',
    };

    const count = movements.length + 1;
    return `${prefixes[type]}-${year}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Crée un nouveau mouvement de stock
   */
  async create(input: CreateMovementInput): Promise<StockMovement> {
    // Validation
    this.validateMovement(input);

    const movementNumber = await this.generateMovementNumber(
      input.workspaceId,
      input.type
    );

    const movement: Partial<StockMovement> = {
      MovementId: uuidv4(),
      MovementNumber: movementNumber,
      Type: input.type,
      ProductId: input.productId,
      SourceWarehouseId: input.sourceWarehouseId,
      DestinationWarehouseId: input.destinationWarehouseId,
      Quantity: input.quantity,
      UnitCost: input.unitCost,
      TotalCost: input.unitCost ? input.quantity * input.unitCost : undefined,
      Reason: input.reason,
      Status: 'pending',
      Reference: input.reference,
      AttachmentUrl: input.attachmentUrl,
      ProcessedById: input.processedById,
      ProcessedAt: new Date().toISOString(),
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<StockMovement>(
      'stock_movements',
      movement
    );

    // Auto-validate certain types of movements
    if (input.type === 'entry' || input.type === 'adjustment') {
      await this.validate({ movementId: created.MovementId, validatedById: input.processedById });
      // Reload to get updated status
      return (await this.getById(created.MovementId))!;
    }

    return created;
  }

  /**
   * Valide un mouvement et met à jour les stocks
   */
  async validate(input: ValidateMovementInput): Promise<StockMovement> {
    const movement = await this.getById(input.movementId);
    if (!movement) {
      throw new Error('Mouvement non trouvé');
    }

    if (movement.Status !== 'pending') {
      throw new Error('Ce mouvement a déjà été traité');
    }

    // Update stock based on movement type
    await this.applyMovementToStock(movement);

    // Update movement status
    const movements = await postgresClient.list<StockMovement>('stock_movements', {
      filterByFormula: `{movement_id} = '${input.movementId}'`,
    });

    if (movements.length === 0 || !movements[0].id) {
      throw new Error('Mouvement non trouvé pour mise à jour');
    }

    const updated = await postgresClient.update<StockMovement>(
      'stock_movements',
      movements[0].id,
      {
        Status: 'validated',
        ValidatedById: input.validatedById,
        ValidatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  /**
   * Annule un mouvement
   */
  async cancel(movementId: string): Promise<StockMovement> {
    const movement = await this.getById(movementId);
    if (!movement) {
      throw new Error('Mouvement non trouvé');
    }

    if (movement.Status === 'validated') {
      throw new Error('Impossible d\'annuler un mouvement validé');
    }

    const movements = await postgresClient.list<StockMovement>('stock_movements', {
      filterByFormula: `{movement_id} = '${movementId}'`,
    });

    if (movements.length === 0 || !movements[0].id) {
      throw new Error('Mouvement non trouvé pour annulation');
    }

    const updated = await postgresClient.update<StockMovement>(
      'stock_movements',
      movements[0].id,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  /**
   * Récupère un mouvement par ID
   */
  async getById(movementId: string): Promise<StockMovement | null> {
    const movements = await postgresClient.list<StockMovement>('stock_movements', {
      filterByFormula: `{movement_id} = '${movementId}'`,
    });

    return movements.length > 0 ? movements[0] : null;
  }

  /**
   * Liste les mouvements avec filtres
   */
  async list(workspaceId: string, filters: MovementFilters = {}): Promise<StockMovement[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.type) {
      filterFormulas.push(`{type} = '${filters.type}'`);
    }

    if (filters.productId) {
      filterFormulas.push(`{product_id} = '${filters.productId}'`);
    }

    if (filters.status) {
      filterFormulas.push(`{status} = '${filters.status}'`);
    }

    if (filters.warehouseId) {
      filterFormulas.push(
        `OR({source_warehouse_id} = '${filters.warehouseId}', {destination_warehouse_id} = '${filters.warehouseId}')`
      );
    }

    if (filters.dateFrom) {
      filterFormulas.push(`{processed_at} >= '${filters.dateFrom}'`);
    }

    if (filters.dateTo) {
      filterFormulas.push(`{processed_at} <= '${filters.dateTo}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<StockMovement>('stock_movements', {
      filterByFormula,
      sort: [{ field: 'ProcessedAt', direction: 'desc' }],
    });
  }

  /**
   * Valide un mouvement avant création
   */
  private validateMovement(input: CreateMovementInput): void {
    if (input.quantity <= 0) {
      throw new Error('La quantité doit être supérieure à 0');
    }

    switch (input.type) {
      case 'entry':
        if (!input.destinationWarehouseId) {
          throw new Error('L\'entrepôt de destination est requis pour une entrée');
        }
        break;

      case 'exit':
        if (!input.sourceWarehouseId) {
          throw new Error('L\'entrepôt source est requis pour une sortie');
        }
        break;

      case 'transfer':
        if (!input.sourceWarehouseId || !input.destinationWarehouseId) {
          throw new Error(
            'Les entrepôts source et destination sont requis pour un transfert'
          );
        }
        if (input.sourceWarehouseId === input.destinationWarehouseId) {
          throw new Error('Les entrepôts source et destination doivent être différents');
        }
        break;

      case 'adjustment':
        if (!input.destinationWarehouseId && !input.sourceWarehouseId) {
          throw new Error('Un entrepôt est requis pour un ajustement');
        }
        break;

      case 'return':
        if (!input.destinationWarehouseId) {
          throw new Error('L\'entrepôt de destination est requis pour un retour');
        }
        break;
    }
  }

  /**
   * Applique le mouvement au stock
   */
  private async applyMovementToStock(movement: StockMovement): Promise<void> {
    switch (movement.Type) {
      case 'entry':
      case 'return':
        // Add to destination warehouse
        await stockService.upsertStockItem({
          productId: movement.ProductId,
          warehouseId: movement.DestinationWarehouseId!,
          quantity: movement.Quantity,
          minimumStock: 10, // Default, should be configured
          unitCost: movement.UnitCost || 0,
          workspaceId: movement.WorkspaceId,
        });
        break;

      case 'exit':
        // Remove from source warehouse
        const exitItem = await stockService.getByProductAndWarehouse(
          movement.ProductId,
          movement.SourceWarehouseId!
        );
        if (!exitItem) {
          throw new Error('Article non trouvé dans l\'entrepôt source');
        }
        if (exitItem.Quantity < movement.Quantity) {
          throw new Error('Stock insuffisant dans l\'entrepôt source');
        }
        await stockService.adjustStock({
          stockItemId: exitItem.StockItemId,
          quantity: movement.Quantity,
          operation: 'subtract',
        });
        break;

      case 'transfer':
        // Remove from source
        const sourceItem = await stockService.getByProductAndWarehouse(
          movement.ProductId,
          movement.SourceWarehouseId!
        );
        if (!sourceItem) {
          throw new Error('Article non trouvé dans l\'entrepôt source');
        }
        if (sourceItem.Quantity < movement.Quantity) {
          throw new Error('Stock insuffisant dans l\'entrepôt source');
        }
        await stockService.adjustStock({
          stockItemId: sourceItem.StockItemId,
          quantity: movement.Quantity,
          operation: 'subtract',
        });

        // Add to destination
        await stockService.upsertStockItem({
          productId: movement.ProductId,
          warehouseId: movement.DestinationWarehouseId!,
          quantity: movement.Quantity,
          minimumStock: 10,
          unitCost: sourceItem.UnitCost,
          workspaceId: movement.WorkspaceId,
        });
        break;

      case 'adjustment':
        // Can be either source (remove) or destination (add)
        if (movement.DestinationWarehouseId) {
          await stockService.upsertStockItem({
            productId: movement.ProductId,
            warehouseId: movement.DestinationWarehouseId,
            quantity: movement.Quantity,
            minimumStock: 10,
            unitCost: movement.UnitCost || 0,
            workspaceId: movement.WorkspaceId,
          });
        } else if (movement.SourceWarehouseId) {
          const adjustItem = await stockService.getByProductAndWarehouse(
            movement.ProductId,
            movement.SourceWarehouseId
          );
          if (adjustItem) {
            await stockService.adjustStock({
              stockItemId: adjustItem.StockItemId,
              quantity: movement.Quantity,
              operation: 'subtract',
            });
          }
        }
        break;
    }
  }
}
