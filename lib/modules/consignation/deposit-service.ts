/**
 * Service - Gestion des Depots de Consignation
 * Module Consignation & Partenaires
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Deposit, DepositLine, DepositStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { PartnerService } from './partner-service';

const postgresClient = getPostgresClient();
const partnerService = new PartnerService();

export interface CreateDepositLineInput {
  productId: string;
  productName: string;
  quantityDeposited: number;
  unitPrice: number;
  currency?: string;
}

export interface CreateDepositInput {
  partnerId: string;
  lines: CreateDepositLineInput[];
  depositDate: string;
  expectedReturnDate?: string;
  warehouseId: string;
  warehouseName?: string;
  preparedById: string;
  preparedByName: string;
  notes?: string;
  deliveryProof?: string;
  workspaceId: string;
}

export interface UpdateDepositInput {
  status?: DepositStatus;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  notes?: string;
  deliveryProof?: string;
}

export interface DepositFilters {
  partnerId?: string;
  status?: DepositStatus;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
}

export class DepositService {
  /**
   * Generer le numero de depot (DEP-202511-0001)
   */
  async generateDepositNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const deposits = await postgresClient.list<Deposit>('deposits', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', YEAR({created_at}) = ${year}, MONTH({created_at}) = ${parseInt(month)})`,
    });
    return `DEP-${year}${month}-${String(deposits.length + 1).padStart(4, '0')}`;
  }

  /**
   * Creer un nouveau depot
   */
  async create(input: CreateDepositInput): Promise<Deposit> {
    // Validation: verifier que le partenaire existe
    const partner = await partnerService.getById(input.partnerId);
    if (!partner) {
      throw new Error('Partenaire non trouve');
    }

    // Validation: partenaire doit etre actif
    if (partner.Status !== 'active') {
      throw new Error('Le partenaire doit etre actif pour effectuer un depot');
    }

    // Validation: au moins une ligne
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Le depot doit contenir au moins un produit');
    }

    // Validation: quantites positives
    for (const line of input.lines) {
      if (line.quantityDeposited <= 0) {
        throw new Error('Les quantites doivent etre positives');
      }
      if (line.unitPrice < 0) {
        throw new Error('Les prix unitaires doivent etre positifs');
      }
    }

    const depositNumber = await this.generateDepositNumber(input.workspaceId);

    // Creer les lignes de depot
    const lines: DepositLine[] = input.lines.map((line) => ({
      DepositLineId: uuidv4(),
      DepositId: '', // Will be set after deposit creation
      ProductId: line.productId,
      ProductName: line.productName,
      QuantityDeposited: line.quantityDeposited,
      QuantitySold: 0,
      QuantityReturned: 0,
      QuantityRemaining: line.quantityDeposited,
      UnitPrice: line.unitPrice,
      TotalValue: line.quantityDeposited * line.unitPrice,
      Currency: line.currency || 'XOF',
    }));

    // Calculer les totaux
    const totalItems = lines.reduce((sum, l) => sum + l.QuantityDeposited, 0);
    const totalValue = lines.reduce((sum, l) => sum + l.TotalValue, 0);

    const deposit: Partial<Deposit> = {
      DepositId: uuidv4(),
      DepositNumber: depositNumber,
      PartnerId: input.partnerId,
      PartnerName: partner.Name,
      PartnerType: partner.Type,
      Status: 'pending',
      Lines: lines,
      TotalItems: totalItems,
      TotalValue: totalValue,
      DepositDate: input.depositDate,
      ExpectedReturnDate: input.expectedReturnDate,
      PreparedById: input.preparedById,
      PreparedByName: input.preparedByName,
      WarehouseId: input.warehouseId,
      WarehouseName: input.warehouseName,
      Notes: input.notes,
      DeliveryProof: input.deliveryProof,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    // Update line IDs with deposit ID
    deposit.Lines!.forEach((line) => {
      line.DepositId = deposit.DepositId!;
    });

    const created = await postgresClient.create<Deposit>('deposits', {
      DepositId: deposit.DepositId,
      DepositNumber: deposit.DepositNumber,
      PartnerId: deposit.PartnerId,
      PartnerName: deposit.PartnerName,
      PartnerType: deposit.PartnerType,
      Status: deposit.Status,
      Lines: deposit.Lines,
      TotalItems: deposit.TotalItems,
      TotalValue: deposit.TotalValue,
      DepositDate: deposit.DepositDate,
      ExpectedReturnDate: deposit.ExpectedReturnDate,
      PreparedById: deposit.PreparedById,
      PreparedByName: deposit.PreparedByName,
      WarehouseId: deposit.WarehouseId,
      WarehouseName: deposit.WarehouseName,
      Notes: deposit.Notes,
      DeliveryProof: deposit.DeliveryProof,
      WorkspaceId: deposit.WorkspaceId,
      CreatedAt: deposit.CreatedAt,
      UpdatedAt: deposit.UpdatedAt,
    });
    return this.mapToDeposit(created);
  }

  /**
   * Recuperer un depot par son ID
   */
  async getById(depositId: string): Promise<Deposit | null> {
    const deposits = await postgresClient.list<any>('deposits', {
      filterByFormula: `{deposit_id} = '${depositId}'`,
    });
    return deposits.length > 0 ? this.mapToDeposit(deposits[0]) : null;
  }

  /**
   * Recuperer un depot par son numero
   */
  async getByNumber(depositNumber: string, workspaceId: string): Promise<Deposit | null> {
    const deposits = await postgresClient.list<any>('deposits', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', {deposit_number} = '${depositNumber}')`,
    });
    return deposits.length > 0 ? this.mapToDeposit(deposits[0]) : null;
  }

  /**
   * Lister les depots avec filtres
   */
  async list(workspaceId: string, filters: DepositFilters = {}): Promise<Deposit[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.partnerId) {
      filterFormulas.push(`{partner_id} = '${filters.partnerId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{status} = '${filters.status}'`);
    }
    if (filters.warehouseId) {
      filterFormulas.push(`{warehouse_id} = '${filters.warehouseId}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{deposit_date} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{deposit_date} <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    const results = await postgresClient.list<any>('deposits', {
      filterByFormula,
      sort: [{ field: 'DepositDate', direction: 'desc' }],
    });
    return results.map((record: any) => this.mapToDeposit(record));
  }

  /**
   * Mettre a jour un depot
   */
  async update(depositId: string, updates: UpdateDepositInput): Promise<Deposit> {
    const deposits = await postgresClient.list<any>('deposits', {
      filterByFormula: `{deposit_id} = '${depositId}'`,
    });

    if (deposits.length === 0) {
      throw new Error('Depot non trouve');
    }

    const deposit = this.mapToDeposit(deposits[0]);

    // Validation: ne peut pas modifier un depot complete ou annule
    if (['completed', 'cancelled'].includes(deposit.Status)) {
      throw new Error('Impossible de modifier un depot complete ou annule');
    }

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.status !== undefined) updateData.Status = updates.status;
    if (updates.expectedReturnDate !== undefined)
      updateData.ExpectedReturnDate = updates.expectedReturnDate;
    if (updates.actualReturnDate !== undefined)
      updateData.ActualReturnDate = updates.actualReturnDate;
    if (updates.notes !== undefined) updateData.Notes = updates.notes;
    if (updates.deliveryProof !== undefined) updateData.DeliveryProof = updates.deliveryProof;

    const updated = await postgresClient.update<any>(
      'deposits',
      deposits[0].id,
      updateData
    );
    return this.mapToDeposit(updated);
  }

  /**
   * Valider un depot (passer de pending a validated)
   */
  async validate(
    depositId: string,
    validatedById: string,
    validatedByName: string
  ): Promise<Deposit> {
    const deposits = await postgresClient.list<any>('deposits', {
      filterByFormula: `{deposit_id} = '${depositId}'`,
    });

    if (deposits.length === 0) {
      throw new Error('Depot non trouve');
    }

    const deposit = this.mapToDeposit(deposits[0]);

    if (deposit.Status !== 'pending') {
      throw new Error('Seuls les depots en attente peuvent etre valides');
    }

    // Mettre a jour les statistiques du partenaire
    await partnerService.incrementDeposited(deposit.PartnerId, deposit.TotalValue);

    const updated = await postgresClient.update<any>('deposits', deposits[0].id, {
      Status: 'validated',
      ValidatedById: validatedById,
      ValidatedByName: validatedByName,
      ValidatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
    return this.mapToDeposit(updated);
  }

  /**
   * Annuler un depot
   */
  async cancel(depositId: string, reason?: string): Promise<Deposit> {
    const deposits = await postgresClient.list<any>('deposits', {
      filterByFormula: `{deposit_id} = '${depositId}'`,
    });

    if (deposits.length === 0) {
      throw new Error('Depot non trouve');
    }

    const deposit = this.mapToDeposit(deposits[0]);

    if (deposit.Status === 'completed') {
      throw new Error('Impossible d\'annuler un depot complete');
    }

    // Si le depot etait valide, ajuster les statistiques du partenaire
    if (deposit.Status === 'validated' || deposit.Status === 'partial') {
      await partnerService.incrementDeposited(deposit.PartnerId, -deposit.TotalValue);
    }

    const updateData: any = {
      Status: 'cancelled',
      UpdatedAt: new Date().toISOString(),
    };

    if (reason) {
      updateData.Notes = deposit.Notes
        ? `${deposit.Notes}\n\nAnnulation: ${reason}`
        : `Annulation: ${reason}`;
    }

    const updated = await postgresClient.update<any>(
      'deposits',
      deposits[0].id,
      updateData
    );
    return this.mapToDeposit(updated);
  }

  /**
   * Mettre a jour les quantites d'une ligne de depot (apres vente ou retour)
   */
  async updateLineQuantities(
    depositId: string,
    productId: string,
    quantitySold: number,
    quantityReturned: number
  ): Promise<Deposit> {
    const deposit = await this.getById(depositId);
    if (!deposit) {
      throw new Error('Depot non trouve');
    }

    const lineIndex = deposit.Lines.findIndex((l) => l.ProductId === productId);
    if (lineIndex === -1) {
      throw new Error('Produit non trouve dans le depot');
    }

    const line = deposit.Lines[lineIndex];

    // Validation: quantites coherentes
    const totalProcessed = quantitySold + quantityReturned;
    if (totalProcessed > line.QuantityDeposited) {
      throw new Error('Les quantites vendues + retournees depassent la quantite deposee');
    }

    // Mettre a jour la ligne
    deposit.Lines[lineIndex] = {
      ...line,
      QuantitySold: quantitySold,
      QuantityReturned: quantityReturned,
      QuantityRemaining: line.QuantityDeposited - totalProcessed,
    };

    // Determiner le nouveau statut du depot
    const allProcessed = deposit.Lines.every((l) => l.QuantityRemaining === 0);
    const someProcessed = deposit.Lines.some(
      (l) => l.QuantitySold > 0 || l.QuantityReturned > 0
    );

    let newStatus: DepositStatus = deposit.Status;
    if (allProcessed) {
      newStatus = 'completed';
    } else if (someProcessed && deposit.Status === 'validated') {
      newStatus = 'partial';
    }

    const deposits = await postgresClient.list<any>('deposits', {
      filterByFormula: `{deposit_id} = '${depositId}'`,
    });

    const updated = await postgresClient.update<any>('deposits', deposits[0].id, {
      Lines: deposit.Lines,
      Status: newStatus,
      UpdatedAt: new Date().toISOString(),
    });
    return this.mapToDeposit(updated);
  }

  /**
   * Obtenir les depots actifs d'un partenaire
   */
  async getActiveDeposits(partnerId: string): Promise<Deposit[]> {
    const deposits = await postgresClient.list<any>('deposits', {
      filterByFormula: `AND({partner_id} = '${partnerId}', OR({status} = 'validated', {status} = 'partial'))`,
      sort: [{ field: 'DepositDate', direction: 'desc' }],
    });

    return deposits.map((record: any) => this.mapToDeposit(record));
  }

  /**
   * Obtenir les statistiques des depots
   */
  async getStatistics(
    workspaceId: string,
    partnerId?: string
  ): Promise<{
    totalDeposits: number;
    byStatus: Record<DepositStatus, number>;
    totalValue: number;
    totalItemsDeposited: number;
    totalItemsSold: number;
    totalItemsReturned: number;
    totalItemsRemaining: number;
  }> {
    const filters: DepositFilters = {};
    if (partnerId) filters.partnerId = partnerId;

    const deposits = await this.list(workspaceId, filters);

    const totalDeposits = deposits.length;

    // Par statut
    const byStatus: Record<DepositStatus, number> = {
      pending: 0,
      validated: 0,
      partial: 0,
      completed: 0,
      cancelled: 0,
    };
    deposits.forEach((d) => {
      byStatus[d.Status]++;
    });

    // Totaux
    const totalValue = deposits.reduce((sum, d) => sum + d.TotalValue, 0);
    const totalItemsDeposited = deposits.reduce((sum, d) => sum + d.TotalItems, 0);

    let totalItemsSold = 0;
    let totalItemsReturned = 0;
    let totalItemsRemaining = 0;

    deposits.forEach((deposit) => {
      deposit.Lines.forEach((line) => {
        totalItemsSold += line.QuantitySold;
        totalItemsReturned += line.QuantityReturned;
        totalItemsRemaining += line.QuantityRemaining;
      });
    });

    return {
      totalDeposits,
      byStatus,
      totalValue,
      totalItemsDeposited,
      totalItemsSold,
      totalItemsReturned,
      totalItemsRemaining,
    };
  }

  /**
   * Obtenir les depots avec retard de retour attendu
   */
  async getOverdueDeposits(workspaceId: string): Promise<Deposit[]> {
    const deposits = await this.list(workspaceId, {
      status: 'validated',
    });

    const now = new Date();

    return deposits.filter((d) => {
      if (!d.ExpectedReturnDate) return false;
      const expectedDate = new Date(d.ExpectedReturnDate);
      return expectedDate < now;
    });
  }

  /**
   * Map database record to Deposit type
   */
  private mapToDeposit(record: any): Deposit {
    return {
      DepositId: record.deposit_id,
      DepositNumber: record.deposit_number,
      PartnerId: record.partner_id,
      PartnerName: record.partner_name,
      PartnerType: record.partner_type,
      Status: record.status,
      Lines: record.lines,
      TotalItems: record.total_items,
      TotalValue: record.total_value,
      DepositDate: record.deposit_date,
      ExpectedReturnDate: record.expected_return_date,
      ActualReturnDate: record.actual_return_date,
      PreparedById: record.prepared_by_id,
      PreparedByName: record.prepared_by_name,
      ValidatedById: record.validated_by_id,
      ValidatedByName: record.validated_by_name,
      ValidatedAt: record.validated_at,
      WarehouseId: record.warehouse_id,
      WarehouseName: record.warehouse_name,
      Notes: record.notes,
      DeliveryProof: record.delivery_proof,
      WorkspaceId: record.workspace_id,
      CreatedAt: record.created_at,
      UpdatedAt: record.updated_at,
    };
  }
}
