/**
 * Service - Gestion des Dépôts de Consignation
 * Module Consignation & Partenaires
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Deposit, DepositLine, DepositStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { PartnerService } from './partner-service';

const airtableClient = new AirtableClient();
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
   * Générer le numéro de dépôt (DEP-202511-0001)
   */
  async generateDepositNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const deposits = await airtableClient.list<Deposit>('Deposit', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({CreatedAt}) = ${year}, MONTH({CreatedAt}) = ${parseInt(month)})`,
    });
    return `DEP-${year}${month}-${String(deposits.length + 1).padStart(4, '0')}`;
  }

  /**
   * Créer un nouveau dépôt
   */
  async create(input: CreateDepositInput): Promise<Deposit> {
    // Validation: vérifier que le partenaire existe
    const partner = await partnerService.getById(input.partnerId);
    if (!partner) {
      throw new Error('Partenaire non trouvé');
    }

    // Validation: partenaire doit être actif
    if (partner.Status !== 'active') {
      throw new Error('Le partenaire doit être actif pour effectuer un dépôt');
    }

    // Validation: au moins une ligne
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Le dépôt doit contenir au moins un produit');
    }

    // Validation: quantités positives
    for (const line of input.lines) {
      if (line.quantityDeposited <= 0) {
        throw new Error('Les quantités doivent être positives');
      }
      if (line.unitPrice < 0) {
        throw new Error('Les prix unitaires doivent être positifs');
      }
    }

    const depositNumber = await this.generateDepositNumber(input.workspaceId);

    // Créer les lignes de dépôt
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

    const created = await airtableClient.create<Deposit>('Deposit', deposit);
    if (!created) {
      throw new Error('Failed to create deposit - Airtable not configured');
    }
    return created;
  }

  /**
   * Récupérer un dépôt par son ID
   */
  async getById(depositId: string): Promise<Deposit | null> {
    const deposits = await airtableClient.list<Deposit>('Deposit', {
      filterByFormula: `{DepositId} = '${depositId}'`,
    });
    return deposits.length > 0 ? deposits[0] : null;
  }

  /**
   * Récupérer un dépôt par son numéro
   */
  async getByNumber(depositNumber: string, workspaceId: string): Promise<Deposit | null> {
    const deposits = await airtableClient.list<Deposit>('Deposit', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {DepositNumber} = '${depositNumber}')`,
    });
    return deposits.length > 0 ? deposits[0] : null;
  }

  /**
   * Lister les dépôts avec filtres
   */
  async list(workspaceId: string, filters: DepositFilters = {}): Promise<Deposit[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.partnerId) {
      filterFormulas.push(`{PartnerId} = '${filters.partnerId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.warehouseId) {
      filterFormulas.push(`{WarehouseId} = '${filters.warehouseId}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{DepositDate} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{DepositDate} <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<Deposit>('Deposit', {
      filterByFormula,
      sort: [{ field: 'DepositDate', direction: 'desc' }],
    });
  }

  /**
   * Mettre à jour un dépôt
   */
  async update(depositId: string, updates: UpdateDepositInput): Promise<Deposit> {
    const deposits = await airtableClient.list<Deposit>('Deposit', {
      filterByFormula: `{DepositId} = '${depositId}'`,
    });

    if (deposits.length === 0) {
      throw new Error('Dépôt non trouvé');
    }

    const deposit = deposits[0];

    // Validation: ne peut pas modifier un dépôt complété ou annulé
    if (['completed', 'cancelled'].includes(deposit.Status)) {
      throw new Error('Impossible de modifier un dépôt complété ou annulé');
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

    const updated = await airtableClient.update<Deposit>(
      'Deposit',
      (deposit as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update deposit - Airtable not configured');
    }
    return updated;
  }

  /**
   * Valider un dépôt (passer de pending à validated)
   */
  async validate(
    depositId: string,
    validatedById: string,
    validatedByName: string
  ): Promise<Deposit> {
    const deposits = await airtableClient.list<Deposit>('Deposit', {
      filterByFormula: `{DepositId} = '${depositId}'`,
    });

    if (deposits.length === 0) {
      throw new Error('Dépôt non trouvé');
    }

    const deposit = deposits[0];

    if (deposit.Status !== 'pending') {
      throw new Error('Seuls les dépôts en attente peuvent être validés');
    }

    // Mettre à jour les statistiques du partenaire
    await partnerService.incrementDeposited(deposit.PartnerId, deposit.TotalValue);

    const updated = await airtableClient.update<Deposit>('Deposit', (deposit as any)._recordId, {
      Status: 'validated',
      ValidatedById: validatedById,
      ValidatedByName: validatedByName,
      ValidatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update deposit - Airtable not configured');
    }
    return updated;
  }

  /**
   * Annuler un dépôt
   */
  async cancel(depositId: string, reason?: string): Promise<Deposit> {
    const deposits = await airtableClient.list<Deposit>('Deposit', {
      filterByFormula: `{DepositId} = '${depositId}'`,
    });

    if (deposits.length === 0) {
      throw new Error('Dépôt non trouvé');
    }

    const deposit = deposits[0];

    if (deposit.Status === 'completed') {
      throw new Error('Impossible d\'annuler un dépôt complété');
    }

    // Si le dépôt était validé, ajuster les statistiques du partenaire
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

    const updated = await airtableClient.update<Deposit>(
      'Deposit',
      (deposit as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update deposit - Airtable not configured');
    }
    return updated;
  }

  /**
   * Mettre à jour les quantités d'une ligne de dépôt (après vente ou retour)
   */
  async updateLineQuantities(
    depositId: string,
    productId: string,
    quantitySold: number,
    quantityReturned: number
  ): Promise<Deposit> {
    const deposit = await this.getById(depositId);
    if (!deposit) {
      throw new Error('Dépôt non trouvé');
    }

    const lineIndex = deposit.Lines.findIndex((l) => l.ProductId === productId);
    if (lineIndex === -1) {
      throw new Error('Produit non trouvé dans le dépôt');
    }

    const line = deposit.Lines[lineIndex];

    // Validation: quantités cohérentes
    const totalProcessed = quantitySold + quantityReturned;
    if (totalProcessed > line.QuantityDeposited) {
      throw new Error('Les quantités vendues + retournées dépassent la quantité déposée');
    }

    // Mettre à jour la ligne
    deposit.Lines[lineIndex] = {
      ...line,
      QuantitySold: quantitySold,
      QuantityReturned: quantityReturned,
      QuantityRemaining: line.QuantityDeposited - totalProcessed,
    };

    // Déterminer le nouveau statut du dépôt
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

    const deposits = await airtableClient.list<Deposit>('Deposit', {
      filterByFormula: `{DepositId} = '${depositId}'`,
    });

    const updated = await airtableClient.update<Deposit>('Deposit', (deposits[0] as any)._recordId, {
      Lines: deposit.Lines,
      Status: newStatus,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update deposit - Airtable not configured');
    }
    return updated;
  }

  /**
   * Obtenir les dépôts actifs d'un partenaire
   */
  async getActiveDeposits(partnerId: string): Promise<Deposit[]> {
    const deposits = await airtableClient.list<Deposit>('Deposit', {
      filterByFormula: `AND({PartnerId} = '${partnerId}', OR({Status} = 'validated', {Status} = 'partial'))`,
      sort: [{ field: 'DepositDate', direction: 'desc' }],
    });

    return deposits;
  }

  /**
   * Obtenir les statistiques des dépôts
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
   * Obtenir les dépôts avec retard de retour attendu
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
}
