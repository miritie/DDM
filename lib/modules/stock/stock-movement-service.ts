/**
 * Service - Gestion des Mouvements de Stock
 * Module Stocks & Mouvements
 * Traçabilité complète: Production → Entrepôt → Distribution
 */

import { AirtableClient } from '@/lib/airtable/client';
import { StockMovement, StockMovementType } from '@/types/modules';
import { StockService } from './stock-service';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();
const stockService = new StockService();

export interface CreateMovementInput {
  type: StockMovementType;
  productId: string;
  sourceWarehouseId?: string; // Pour transfer, exit
  destinationWarehouseId?: string; // Pour entry, transfer
  quantity: number;
  unitCost?: number;
  reason?: string;
  reference?: string;
  processedById: string;
  workspaceId: string;
}

export class StockMovementService {
  /**
   * Créer un mouvement de stock avec mise à jour automatique des stocks
   */
  async create(input: CreateMovementInput): Promise<StockMovement> {
    const movementNumber = await this.generateMovementNumber(input.workspaceId, input.type);

    // Valider le mouvement selon le type
    this.validateMovement(input);

    // Créer le mouvement
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
      Reference: input.reference,
      Status: 'pending',
      ProcessedById: input.processedById,
      ProcessedAt: new Date().toISOString(),
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const createdMovement = await airtableClient.create<StockMovement>('StockMovement', movement);

    // Valider automatiquement le mouvement (mettre à jour les stocks)
    await this.validate(createdMovement.MovementId);

    return createdMovement;
  }

  /**
   * Valider le mouvement et mettre à jour les stocks
   */
  async validate(movementId: string): Promise<StockMovement> {
    const movements = await airtableClient.list<StockMovement>('StockMovement', {
      filterByFormula: `{MovementId} = '${movementId}'`,
    });

    if (movements.length === 0) {
      throw new Error('Mouvement non trouvé');
    }

    const movement = movements[0];

    if (movement.Status === 'validated') {
      throw new Error('Mouvement déjà validé');
    }

    if (movement.Status === 'cancelled') {
      throw new Error('Impossible de valider un mouvement annulé');
    }

    // Mettre à jour les stocks selon le type de mouvement
    try {
      switch (movement.Type) {
        case 'entry':
          // Entrée (production → entrepôt)
          if (!movement.DestinationWarehouseId) {
            throw new Error('Entrepôt de destination requis pour une entrée');
          }
          await stockService.increaseStock(
            movement.ProductId,
            movement.DestinationWarehouseId,
            movement.Quantity,
            movement.UnitCost
          );
          break;

        case 'exit':
          // Sortie (entrepôt → vente/utilisation)
          if (!movement.SourceWarehouseId) {
            throw new Error('Entrepôt source requis pour une sortie');
          }
          await stockService.decreaseStock(
            movement.ProductId,
            movement.SourceWarehouseId,
            movement.Quantity
          );
          break;

        case 'transfer':
          // Transfert (entrepôt A → entrepôt B)
          if (!movement.SourceWarehouseId || !movement.DestinationWarehouseId) {
            throw new Error('Entrepôts source et destination requis pour un transfert');
          }
          await stockService.decreaseStock(
            movement.ProductId,
            movement.SourceWarehouseId,
            movement.Quantity
          );
          await stockService.increaseStock(
            movement.ProductId,
            movement.DestinationWarehouseId,
            movement.Quantity,
            movement.UnitCost
          );
          break;

        case 'adjustment':
          // Ajustement (inventaire, correction)
          if (!movement.DestinationWarehouseId) {
            throw new Error('Entrepôt requis pour un ajustement');
          }
          const currentStock = await stockService.getByProductAndWarehouse(
            movement.ProductId,
            movement.DestinationWarehouseId
          );
          if (currentStock) {
            const diff = movement.Quantity - currentStock.Quantity;
            if (diff > 0) {
              await stockService.increaseStock(
                movement.ProductId,
                movement.DestinationWarehouseId,
                diff
              );
            } else if (diff < 0) {
              await stockService.decreaseStock(
                movement.ProductId,
                movement.DestinationWarehouseId,
                Math.abs(diff)
              );
            }
          }
          break;

        case 'return':
          // Retour (client/fournisseur → entrepôt)
          if (!movement.DestinationWarehouseId) {
            throw new Error('Entrepôt de destination requis pour un retour');
          }
          await stockService.increaseStock(
            movement.ProductId,
            movement.DestinationWarehouseId,
            movement.Quantity,
            movement.UnitCost
          );
          break;
      }

      // Marquer le mouvement comme validé
      return await airtableClient.update<StockMovement>(
        'StockMovement',
        (movements[0] as any)._recordId,
        {
          Status: 'validated',
          ValidatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
        }
      );
    } catch (error: any) {
      // En cas d'erreur, annuler le mouvement
      await airtableClient.update<StockMovement>(
        'StockMovement',
        (movements[0] as any)._recordId,
        {
          Status: 'cancelled',
          UpdatedAt: new Date().toISOString(),
        }
      );
      throw error;
    }
  }

  /**
   * Annuler un mouvement
   */
  async cancel(movementId: string): Promise<StockMovement> {
    const movements = await airtableClient.list<StockMovement>('StockMovement', {
      filterByFormula: `{MovementId} = '${movementId}'`,
    });

    if (movements.length === 0) {
      throw new Error('Mouvement non trouvé');
    }

    if (movements[0].Status === 'validated') {
      throw new Error('Impossible d\'annuler un mouvement validé. Créez un mouvement inverse.');
    }

    return await airtableClient.update<StockMovement>(
      'StockMovement',
      (movements[0] as any)._recordId,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  /**
   * Générer un numéro de mouvement
   */
  async generateMovementNumber(workspaceId: string, type: StockMovementType): Promise<string> {
    const year = new Date().getFullYear();
    const movements = await airtableClient.list<StockMovement>('StockMovement', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Type} = '${type}', YEAR({CreatedAt}) = ${year})`,
    });

    const prefix = this.getMovementPrefix(type);
    return `${prefix}-${year}-${String(movements.length + 1).padStart(4, '0')}`;
  }

  /**
   * Obtenir le préfixe selon le type de mouvement
   */
  private getMovementPrefix(type: StockMovementType): string {
    const prefixes: Record<StockMovementType, string> = {
      entry: 'ENT',      // Entrée (production)
      exit: 'SOR',       // Sortie (vente)
      transfer: 'TRF',   // Transfert
      adjustment: 'AJU', // Ajustement
      return: 'RET',     // Retour
    };
    return prefixes[type];
  }

  /**
   * Valider les données du mouvement
   */
  private validateMovement(input: CreateMovementInput): void {
    if (input.quantity <= 0) {
      throw new Error('La quantité doit être positive');
    }

    switch (input.type) {
      case 'entry':
        if (!input.destinationWarehouseId) {
          throw new Error('Entrepôt de destination requis pour une entrée');
        }
        break;
      case 'exit':
        if (!input.sourceWarehouseId) {
          throw new Error('Entrepôt source requis pour une sortie');
        }
        break;
      case 'transfer':
        if (!input.sourceWarehouseId || !input.destinationWarehouseId) {
          throw new Error('Entrepôts source et destination requis pour un transfert');
        }
        if (input.sourceWarehouseId === input.destinationWarehouseId) {
          throw new Error('Les entrepôts source et destination doivent être différents');
        }
        break;
    }
  }

  /**
   * Récupérer un mouvement par ID
   */
  async getById(movementId: string): Promise<StockMovement | null> {
    const movements = await airtableClient.list<StockMovement>('StockMovement', {
      filterByFormula: `{MovementId} = '${movementId}'`,
    });

    return movements.length > 0 ? movements[0] : null;
  }

  /**
   * Lister les mouvements
   */
  async list(workspaceId: string, filters: {
    type?: StockMovementType;
    productId?: string;
    warehouseId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<StockMovement[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.type) {
      filterFormulas.push(`{Type} = '${filters.type}'`);
    }
    if (filters.productId) {
      filterFormulas.push(`{ProductId} = '${filters.productId}'`);
    }
    if (filters.warehouseId) {
      filterFormulas.push(`OR({SourceWarehouseId} = '${filters.warehouseId}', {DestinationWarehouseId} = '${filters.warehouseId}')`);
    }
    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{CreatedAt} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{CreatedAt} <= '${filters.endDate}'`);
    }

    const filterByFormula = filterFormulas.length > 1
      ? `AND(${filterFormulas.join(', ')})`
      : filterFormulas[0];

    return await airtableClient.list<StockMovement>('StockMovement', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  /**
   * Statistiques des mouvements
   */
  async getStatistics(workspaceId: string, startDate?: string, endDate?: string): Promise<{
    totalMovements: number;
    byType: Record<StockMovementType, number>;
    validated: number;
    pending: number;
    cancelled: number;
  }> {
    const movements = await this.list(workspaceId, { startDate, endDate });

    const byType: Record<StockMovementType, number> = {
      entry: 0,
      exit: 0,
      transfer: 0,
      adjustment: 0,
      return: 0,
    };

    movements.forEach(m => {
      byType[m.Type] = (byType[m.Type] || 0) + 1;
    });

    return {
      totalMovements: movements.length,
      byType,
      validated: movements.filter(m => m.Status === 'validated').length,
      pending: movements.filter(m => m.Status === 'pending').length,
      cancelled: movements.filter(m => m.Status === 'cancelled').length,
    };
  }
}
