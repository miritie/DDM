/**
 * Service - Gestion des Retours de Consignation
 * Module Consignation & Partenaires
 */

import { AirtableClient } from '@/lib/airtable/client';
import { ConsignationReturn } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { PartnerService } from './partner-service';
import { DepositService } from './deposit-service';

const airtableClient = new AirtableClient();
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
   * Générer le numéro de retour (RET-202511-0001)
   */
  async generateReturnNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const returns = await airtableClient.list<ConsignationReturn>('ConsignationReturn', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({CreatedAt}) = ${year}, MONTH({CreatedAt}) = ${parseInt(month)})`,
    });
    return `RET-${year}${month}-${String(returns.length + 1).padStart(4, '0')}`;
  }

  /**
   * Créer un nouveau retour de consignation
   */
  async create(input: CreateConsignationReturnInput): Promise<ConsignationReturn> {
    // Validation: vérifier que le dépôt existe
    const deposit = await depositService.getById(input.depositId);
    if (!deposit) {
      throw new Error('Dépôt non trouvé');
    }

    // Validation: dépôt doit être validé ou partial
    if (!['validated', 'partial'].includes(deposit.Status)) {
      throw new Error('Seuls les dépôts validés ou partiels peuvent faire l\'objet d\'un retour');
    }

    // Validation: au moins une ligne
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Le retour doit contenir au moins un produit');
    }

    // Validation: quantités positives et cohérentes avec le dépôt
    for (const line of input.lines) {
      if (line.quantityReturned <= 0) {
        throw new Error('Les quantités retournées doivent être positives');
      }

      // Vérifier que le produit existe dans le dépôt
      const depositLine = deposit.Lines.find((l) => l.ProductId === line.productId);
      if (!depositLine) {
        throw new Error(
          `Le produit ${line.productName} n'existe pas dans le dépôt ${deposit.DepositNumber}`
        );
      }

      // Vérifier que la quantité retournée ne dépasse pas la quantité restante
      if (line.quantityReturned > depositLine.QuantityRemaining) {
        throw new Error(
          `La quantité retournée pour ${line.productName} (${line.quantityReturned}) dépasse la quantité restante dans le dépôt (${depositLine.QuantityRemaining})`
        );
      }
    }

    const returnNumber = await this.generateReturnNumber(input.workspaceId);

    // Récupérer le partenaire du dépôt
    const partner = await partnerService.getById(deposit.PartnerId);
    if (!partner) {
      throw new Error('Partenaire non trouvé');
    }

    const returnDoc: Partial<ConsignationReturn> = {
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

    // Créer le retour
    const created = await airtableClient.create<ConsignationReturn>(
      'ConsignationReturn',
      returnDoc
    );
    if (!created) {
      throw new Error('Failed to create consignation return - Airtable not configured');
    }

    // Mettre à jour les quantités dans le dépôt
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

    // Calculer la valeur totale retournée
    let totalReturnedValue = 0;
    for (const line of input.lines) {
      const depositLine = deposit.Lines.find((l) => l.ProductId === line.productId);
      if (depositLine) {
        totalReturnedValue += line.quantityReturned * depositLine.UnitPrice;
      }
    }

    // Mettre à jour les statistiques du partenaire
    await partnerService.incrementReturned(deposit.PartnerId, totalReturnedValue);

    return created;
  }

  /**
   * Récupérer un retour par son ID
   */
  async getById(returnId: string): Promise<ConsignationReturn | null> {
    const returns = await airtableClient.list<ConsignationReturn>('ConsignationReturn', {
      filterByFormula: `{ReturnId} = '${returnId}'`,
    });
    return returns.length > 0 ? returns[0] : null;
  }

  /**
   * Récupérer un retour par son numéro
   */
  async getByNumber(returnNumber: string, workspaceId: string): Promise<ConsignationReturn | null> {
    const returns = await airtableClient.list<ConsignationReturn>('ConsignationReturn', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {ReturnNumber} = '${returnNumber}')`,
    });
    return returns.length > 0 ? returns[0] : null;
  }

  /**
   * Lister les retours avec filtres
   */
  async list(
    workspaceId: string,
    filters: ConsignationReturnFilters = {}
  ): Promise<ConsignationReturn[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.depositId) {
      filterFormulas.push(`{DepositId} = '${filters.depositId}'`);
    }
    if (filters.partnerId) {
      filterFormulas.push(`{PartnerId} = '${filters.partnerId}'`);
    }
    if (filters.warehouseId) {
      filterFormulas.push(`{WarehouseId} = '${filters.warehouseId}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{ReturnDate} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{ReturnDate} <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<ConsignationReturn>('ConsignationReturn', {
      filterByFormula,
      sort: [{ field: 'ReturnDate', direction: 'desc' }],
    });
  }

  /**
   * Obtenir les retours d'un dépôt spécifique
   */
  async getByDeposit(depositId: string): Promise<ConsignationReturn[]> {
    return await airtableClient.list<ConsignationReturn>('ConsignationReturn', {
      filterByFormula: `{DepositId} = '${depositId}'`,
      sort: [{ field: 'ReturnDate', direction: 'desc' }],
    });
  }

  /**
   * Obtenir les retours d'un partenaire
   */
  async getByPartner(partnerId: string): Promise<ConsignationReturn[]> {
    return await airtableClient.list<ConsignationReturn>('ConsignationReturn', {
      filterByFormula: `{PartnerId} = '${partnerId}'`,
      sort: [{ field: 'ReturnDate', direction: 'desc' }],
    });
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

    // Comptabiliser les articles retournés
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
   * Obtenir les retours récents (derniers N jours)
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
      throw new Error('Partenaire non trouvé');
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
   * Obtenir les produits les plus retournés
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
   * Mettre à jour les notes d'un retour
   */
  async updateNotes(returnId: string, notes: string): Promise<ConsignationReturn> {
    const returns = await airtableClient.list<ConsignationReturn>('ConsignationReturn', {
      filterByFormula: `{ReturnId} = '${returnId}'`,
    });

    if (returns.length === 0) {
      throw new Error('Retour non trouvé');
    }

    const updated = await airtableClient.update<ConsignationReturn>(
      'ConsignationReturn',
      (returns[0] as any)._recordId,
      {
        Notes: notes,
        UpdatedAt: new Date().toISOString(),
      }
    );
    if (!updated) {
      throw new Error('Failed to update consignation return - Airtable not configured');
    }
    return updated;
  }
}
