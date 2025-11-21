/**
 * Service - Gestion des Retours de Consignation
 * Module Consignation & Partenaires
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { ConsignationReturn } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { PartnerService } from './partner-service';
import { DepositService } from './deposit-service';

const postgresClient = getPostgresClient();
const partnerService = new PartnerService();
const depositService = new DepositService();

export interface ConsignationReturnLineInput {
  productId: string;
  productName: string;
  quantityReturned: number;
  condition: 'good' | 'damaged' | 'expired';
  notes?: string;
}

export interface CreateConsignationReturnInput {
  depositId: string;
  lines: ConsignationReturnLineInput[];
  returnDate: string;
  warehouseId: string;
  warehouseName?: string;
  receivedById: string;
  receivedByName: string;
  notes?: string;
  returnProof?: string;
  workspaceId: string;
}

export interface ConsignationReturnFilters {
  depositId?: string;
  partnerId?: string;
  warehouseId?: string;
  startDate?: string;
  endDate?: string;
  condition?: 'good' | 'damaged' | 'expired';
}

export class ConsignationReturnService {
  /**
   * Generer le numero de retour (RET-202511-0001)
   */
  async generateReturnNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const returns = await postgresClient.list<any>('consignation_returns', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', YEAR({created_at}) = ${year}, MONTH({created_at}) = ${parseInt(month)})`,
    });
    return `RET-${year}${month}-${String(returns.length + 1).padStart(4, '0')}`;
  }

  /**
   * Creer un nouveau retour de consignation
   */
  async create(input: CreateConsignationReturnInput): Promise<ConsignationReturn> {
    // Validation: verifier que le depot existe
    const deposit = await depositService.getById(input.depositId);
    if (!deposit) {
      throw new Error('Depot non trouve');
    }

    // Validation: depot doit etre valide ou partial
    if (!['validated', 'partial'].includes(deposit.Status)) {
      throw new Error('Seuls les depots valides ou partiels peuvent faire l\'objet d\'un retour');
    }

    // Validation: au moins une ligne
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Le retour doit contenir au moins un produit');
    }

    // Validation: quantites positives et coherentes avec le depot
    for (const line of input.lines) {
      if (line.quantityReturned <= 0) {
        throw new Error('Les quantites retournees doivent etre positives');
      }

      // Verifier que le produit existe dans le depot
      const depositLine = deposit.Lines.find((l) => l.ProductId === line.productId);
      if (!depositLine) {
        throw new Error(
          `Le produit ${line.productName} n'existe pas dans le depot ${deposit.DepositNumber}`
        );
      }

      // Verifier que la quantite retournee ne depasse pas la quantite restante
      if (line.quantityReturned > depositLine.QuantityRemaining) {
        throw new Error(
          `La quantite retournee pour ${line.productName} (${line.quantityReturned}) depasse la quantite restante dans le depot (${depositLine.QuantityRemaining})`
        );
      }
    }

    const returnNumber = await this.generateReturnNumber(input.workspaceId);

    // Recuperer le partenaire du depot
    const partner = await partnerService.getById(deposit.PartnerId);
    if (!partner) {
      throw new Error('Partenaire non trouve');
    }

    const returnDoc: any = {
      ReturnId: uuidv4(),
      ReturnNumber: returnNumber,
      DepositId: input.depositId,
      DepositNumber: deposit.DepositNumber,
      PartnerId: deposit.PartnerId,
      PartnerName: deposit.PartnerName,
      Lines: input.lines.map((line) => ({
        ProductId: line.productId,
        ProductName: line.productName,
        QuantityReturned: line.quantityReturned,
        Condition: line.condition,
        Notes: line.notes,
      })),
      ReturnDate: input.returnDate,
      ReceivedById: input.receivedById,
      ReceivedByName: input.receivedByName,
      WarehouseId: input.warehouseId,
      WarehouseName: input.warehouseName,
      Notes: input.notes,
      ReturnProof: input.returnProof,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    // Creer le retour
    const created = await postgresClient.create<any>(
      'consignation_returns',
      returnDoc
    );

    // Mettre a jour les quantites dans le depot
    for (const line of input.lines) {
      const depositLine = deposit.Lines.find((l) => l.ProductId === line.productId);
      if (depositLine) {
        await depositService.updateLineQuantities(
          input.depositId,
          line.productId,
          depositLine.QuantitySold,
          depositLine.QuantityReturned + line.quantityReturned
        );
      }
    }

    // Calculer la valeur totale retournee
    let totalReturnedValue = 0;
    for (const line of input.lines) {
      const depositLine = deposit.Lines.find((l) => l.ProductId === line.productId);
      if (depositLine) {
        totalReturnedValue += line.quantityReturned * depositLine.UnitPrice;
      }
    }

    // Mettre a jour les statistiques du partenaire
    await partnerService.incrementReturned(deposit.PartnerId, totalReturnedValue);

    return this.mapToConsignationReturn(created);
  }

  /**
   * Recuperer un retour par son ID
   */
  async getById(returnId: string): Promise<ConsignationReturn | null> {
    const returns = await postgresClient.list<any>('consignation_returns', {
      filterByFormula: `{return_id} = '${returnId}'`,
    });
    return returns.length > 0 ? this.mapToConsignationReturn(returns[0]) : null;
  }

  /**
   * Recuperer un retour par son numero
   */
  async getByNumber(returnNumber: string, workspaceId: string): Promise<ConsignationReturn | null> {
    const returns = await postgresClient.list<any>('consignation_returns', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', {return_number} = '${returnNumber}')`,
    });
    return returns.length > 0 ? this.mapToConsignationReturn(returns[0]) : null;
  }

  /**
   * Lister les retours avec filtres
   */
  async list(
    workspaceId: string,
    filters: ConsignationReturnFilters = {}
  ): Promise<ConsignationReturn[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.depositId) {
      filterFormulas.push(`{deposit_id} = '${filters.depositId}'`);
    }
    if (filters.partnerId) {
      filterFormulas.push(`{partner_id} = '${filters.partnerId}'`);
    }
    if (filters.warehouseId) {
      filterFormulas.push(`{warehouse_id} = '${filters.warehouseId}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{return_date} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{return_date} <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    const results = await postgresClient.list<any>('consignation_returns', {
      filterByFormula,
      sort: [{ field: 'ReturnDate', direction: 'desc' }],
    });
    return results.map((record: any) => this.mapToConsignationReturn(record));
  }

  /**
   * Obtenir les retours d'un depot specifique
   */
  async getByDeposit(depositId: string): Promise<ConsignationReturn[]> {
    const results = await postgresClient.list<any>('consignation_returns', {
      filterByFormula: `{deposit_id} = '${depositId}'`,
      sort: [{ field: 'ReturnDate', direction: 'desc' }],
    });
    return results.map((record: any) => this.mapToConsignationReturn(record));
  }

  /**
   * Obtenir les retours d'un partenaire
   */
  async getByPartner(partnerId: string): Promise<ConsignationReturn[]> {
    const results = await postgresClient.list<any>('consignation_returns', {
      filterByFormula: `{partner_id} = '${partnerId}'`,
      sort: [{ field: 'ReturnDate', direction: 'desc' }],
    });
    return results.map((record: any) => this.mapToConsignationReturn(record));
  }

  /**
   * Obtenir les statistiques des retours
   */
  async getStatistics(
    workspaceId: string,
    partnerId?: string,
    depositId?: string
  ): Promise<{
    totalReturns: number;
    totalItemsReturned: number;
    byCondition: {
      good: number;
      damaged: number;
      expired: number;
    };
    returnsByPartner: Array<{
      partnerId: string;
      partnerName: string;
      totalReturns: number;
      totalItems: number;
    }>;
  }> {
    const filters: ConsignationReturnFilters = {};
    if (partnerId) filters.partnerId = partnerId;
    if (depositId) filters.depositId = depositId;

    const returns = await this.list(workspaceId, filters);

    const totalReturns = returns.length;

    // Comptabiliser les articles retournes
    let totalItemsReturned = 0;
    const byCondition = {
      good: 0,
      damaged: 0,
      expired: 0,
    };

    returns.forEach((ret) => {
      ret.Lines.forEach((line) => {
        totalItemsReturned += line.QuantityReturned;
        byCondition[line.Condition] += line.QuantityReturned;
      });
    });

    // Statistiques par partenaire
    const partnerStats: Record<
      string,
      { partnerId: string; partnerName: string; totalReturns: number; totalItems: number }
    > = {};

    returns.forEach((ret) => {
      if (!partnerStats[ret.PartnerId]) {
        partnerStats[ret.PartnerId] = {
          partnerId: ret.PartnerId,
          partnerName: ret.PartnerName,
          totalReturns: 0,
          totalItems: 0,
        };
      }
      partnerStats[ret.PartnerId].totalReturns++;
      ret.Lines.forEach((line) => {
        partnerStats[ret.PartnerId].totalItems += line.QuantityReturned;
      });
    });

    const returnsByPartner = Object.values(partnerStats).sort(
      (a, b) => b.totalReturns - a.totalReturns
    );

    return {
      totalReturns,
      totalItemsReturned,
      byCondition,
      returnsByPartner,
    };
  }

  /**
   * Obtenir les retours recents (derniers N jours)
   */
  async getRecentReturns(workspaceId: string, days: number = 7): Promise<ConsignationReturn[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.list(workspaceId, {
      startDate: startDate.toISOString(),
    });
  }

  /**
   * Calculer le taux de retour d'un partenaire
   */
  async calculateReturnRate(partnerId: string): Promise<{
    totalDeposited: number;
    totalReturned: number;
    returnRate: number;
  }> {
    const partner = await partnerService.getById(partnerId);
    if (!partner) {
      throw new Error('Partenaire non trouve');
    }

    const totalDeposited = partner.TotalDeposited;
    const totalReturned = partner.TotalReturned;
    const returnRate = totalDeposited > 0 ? (totalReturned / totalDeposited) * 100 : 0;

    return {
      totalDeposited,
      totalReturned,
      returnRate,
    };
  }

  /**
   * Obtenir les produits les plus retournes
   */
  async getMostReturnedProducts(
    workspaceId: string,
    limit: number = 10
  ): Promise<
    Array<{
      productId: string;
      productName: string;
      totalReturned: number;
      byCondition: { good: number; damaged: number; expired: number };
    }>
  > {
    const returns = await this.list(workspaceId);

    const productStats: Record<
      string,
      {
        productId: string;
        productName: string;
        totalReturned: number;
        byCondition: { good: number; damaged: number; expired: number };
      }
    > = {};

    returns.forEach((ret) => {
      ret.Lines.forEach((line) => {
        if (!productStats[line.ProductId]) {
          productStats[line.ProductId] = {
            productId: line.ProductId,
            productName: line.ProductName,
            totalReturned: 0,
            byCondition: { good: 0, damaged: 0, expired: 0 },
          };
        }
        productStats[line.ProductId].totalReturned += line.QuantityReturned;
        productStats[line.ProductId].byCondition[line.Condition] += line.QuantityReturned;
      });
    });

    return Object.values(productStats)
      .sort((a, b) => b.totalReturned - a.totalReturned)
      .slice(0, limit);
  }

  /**
   * Mettre a jour les notes d'un retour
   */
  async updateNotes(returnId: string, notes: string): Promise<ConsignationReturn> {
    const returns = await postgresClient.list<any>('consignation_returns', {
      filterByFormula: `{return_id} = '${returnId}'`,
    });

    if (returns.length === 0) {
      throw new Error('Retour non trouve');
    }

    const updated = await postgresClient.update<any>(
      'consignation_returns',
      returns[0].id,
      {
        Notes: notes,
        UpdatedAt: new Date().toISOString(),
      }
    );
    return this.mapToConsignationReturn(updated);
  }

  /**
   * Map database record to ConsignationReturn type
   */
  private mapToConsignationReturn(record: any): ConsignationReturn {
    return {
      ReturnId: record.return_id,
      ReturnNumber: record.return_number,
      DepositId: record.deposit_id,
      DepositNumber: record.deposit_number,
      PartnerId: record.partner_id,
      PartnerName: record.partner_name,
      Lines: record.lines,
      ReturnDate: record.return_date,
      ReceivedById: record.received_by_id,
      ReceivedByName: record.received_by_name,
      WarehouseId: record.warehouse_id,
      WarehouseName: record.warehouse_name,
      Notes: record.notes,
      ReturnProof: record.return_proof,
      WorkspaceId: record.workspace_id,
      CreatedAt: record.created_at,
      UpdatedAt: record.updated_at,
    };
  }
}
