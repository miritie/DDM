/**
 * Service - Gestion des Règlements aux Partenaires
 * Module Consignation & Partenaires
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Settlement, SettlementStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { PartnerService } from './partner-service';
import { SalesReportService } from './sales-report-service';

const airtableClient = new AirtableClient();
const partnerService = new PartnerService();
const salesReportService = new SalesReportService();

export interface CreateSettlementInput {
  partnerId: string;
  salesReportIds: string[];
  preparedById: string;
  preparedByName: string;
  notes?: string;
  workspaceId: string;
}

export interface PaySettlementInput {
  paymentMethod: 'cash' | 'bank_transfer' | 'mobile_money' | 'check';
  paymentDate: string;
  paymentProof?: string;
  walletId?: string;
  paidById: string;
  paidByName: string;
  amount?: number; // Si paiement partiel
}

export interface SettlementFilters {
  partnerId?: string;
  status?: SettlementStatus;
  startDate?: string;
  endDate?: string;
}

export class SettlementService {
  /**
   * Générer le numéro de règlement (SET-202511-0001)
   */
  async generateSettlementNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const settlements = await airtableClient.list<Settlement>('Settlement', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({CreatedAt}) = ${year}, MONTH({CreatedAt}) = ${parseInt(month)})`,
    });
    return `SET-${year}${month}-${String(settlements.length + 1).padStart(4, '0')}`;
  }

  /**
   * Créer un nouveau règlement
   */
  async create(input: CreateSettlementInput): Promise<Settlement> {
    // Validation: vérifier que le partenaire existe
    const partner = await partnerService.getById(input.partnerId);
    if (!partner) {
      throw new Error('Partenaire non trouvé');
    }

    // Validation: au moins un rapport de ventes
    if (!input.salesReportIds || input.salesReportIds.length === 0) {
      throw new Error('Le règlement doit inclure au moins un rapport de ventes');
    }

    // Validation: vérifier que tous les rapports existent et appartiennent au partenaire
    let totalDue = 0;
    for (const reportId of input.salesReportIds) {
      const report = await salesReportService.getById(reportId);
      if (!report) {
        throw new Error(`Rapport de ventes ${reportId} non trouvé`);
      }
      if (report.PartnerId !== input.partnerId) {
        throw new Error(`Le rapport ${report.ReportNumber} n'appartient pas à ce partenaire`);
      }
      if (!['validated', 'processed'].includes(report.Status)) {
        throw new Error(
          `Le rapport ${report.ReportNumber} doit être validé ou traité pour être inclus dans un règlement`
        );
      }
      totalDue += report.NetAmount;
    }

    const settlementNumber = await this.generateSettlementNumber(input.workspaceId);

    const settlement: Partial<Settlement> = {
      SettlementId: uuidv4(),
      SettlementNumber: settlementNumber,
      PartnerId: input.partnerId,
      PartnerName: partner.Name,
      Status: 'pending',
      TotalDue: totalDue,
      AmountPaid: 0,
      AmountRemaining: totalDue,
      Currency: 'XOF',
      SalesReportIds: input.salesReportIds,
      PreparedById: input.preparedById,
      PreparedByName: input.preparedByName,
      Notes: input.notes,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<Settlement>('Settlement', settlement);
    if (!created) {
      throw new Error('Failed to create settlement - Airtable not configured');
    }
    return created;
  }

  /**
   * Récupérer un règlement par son ID
   */
  async getById(settlementId: string): Promise<Settlement | null> {
    const settlements = await airtableClient.list<Settlement>('Settlement', {
      filterByFormula: `{SettlementId} = '${settlementId}'`,
    });
    return settlements.length > 0 ? settlements[0] : null;
  }

  /**
   * Récupérer un règlement par son numéro
   */
  async getByNumber(settlementNumber: string, workspaceId: string): Promise<Settlement | null> {
    const settlements = await airtableClient.list<Settlement>('Settlement', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {SettlementNumber} = '${settlementNumber}')`,
    });
    return settlements.length > 0 ? settlements[0] : null;
  }

  /**
   * Lister les règlements avec filtres
   */
  async list(workspaceId: string, filters: SettlementFilters = {}): Promise<Settlement[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.partnerId) {
      filterFormulas.push(`{PartnerId} = '${filters.partnerId}'`);
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

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<Settlement>('Settlement', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  /**
   * Payer un règlement (complet ou partiel)
   */
  async pay(settlementId: string, input: PaySettlementInput): Promise<Settlement> {
    const settlements = await airtableClient.list<Settlement>('Settlement', {
      filterByFormula: `{SettlementId} = '${settlementId}'`,
    });

    if (settlements.length === 0) {
      throw new Error('Règlement non trouvé');
    }

    const settlement = settlements[0];

    if (settlement.Status === 'completed') {
      throw new Error('Ce règlement a déjà été payé intégralement');
    }

    if (settlement.Status === 'cancelled') {
      throw new Error('Impossible de payer un règlement annulé');
    }

    // Montant à payer (par défaut: le restant, sinon le montant spécifié)
    const paymentAmount = input.amount || settlement.AmountRemaining;

    // Validation: montant ne doit pas dépasser le restant
    if (paymentAmount > settlement.AmountRemaining) {
      throw new Error('Le montant à payer dépasse le montant restant');
    }

    // Validation: montant positif
    if (paymentAmount <= 0) {
      throw new Error('Le montant à payer doit être positif');
    }

    const newAmountPaid = settlement.AmountPaid + paymentAmount;
    const newAmountRemaining = settlement.TotalDue - newAmountPaid;

    // Déterminer le nouveau statut
    let newStatus: SettlementStatus;
    if (newAmountRemaining === 0) {
      newStatus = 'completed';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'pending';
    }

    // Mettre à jour le solde du partenaire
    await partnerService.pay(settlement.PartnerId, paymentAmount);

    // Mettre à jour le règlement
    const updateData: any = {
      Status: newStatus,
      AmountPaid: newAmountPaid,
      AmountRemaining: newAmountRemaining,
      PaymentMethod: input.paymentMethod,
      PaymentDate: input.paymentDate,
      PaymentProof: input.paymentProof,
      WalletId: input.walletId,
      PaidById: input.paidById,
      PaidByName: input.paidByName,
      UpdatedAt: new Date().toISOString(),
    };

    const updated = await airtableClient.update<Settlement>(
      'Settlement',
      (settlement as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update settlement - Airtable not configured');
    }
    return updated;
  }

  /**
   * Annuler un règlement
   */
  async cancel(settlementId: string, reason?: string): Promise<Settlement> {
    const settlements = await airtableClient.list<Settlement>('Settlement', {
      filterByFormula: `{SettlementId} = '${settlementId}'`,
    });

    if (settlements.length === 0) {
      throw new Error('Règlement non trouvé');
    }

    const settlement = settlements[0];

    if (settlement.Status === 'completed') {
      throw new Error('Impossible d\'annuler un règlement déjà payé intégralement');
    }

    // Si déjà partiellement payé, ajuster le solde du partenaire
    if (settlement.AmountPaid > 0) {
      const partner = await partnerService.getById(settlement.PartnerId);
      if (partner) {
        await partnerService.updateFinancials(settlement.PartnerId, {
          currentBalance: partner.CurrentBalance + settlement.AmountPaid,
        });
      }
    }

    const updateData: any = {
      Status: 'cancelled',
      UpdatedAt: new Date().toISOString(),
    };

    if (reason) {
      updateData.Notes = settlement.Notes
        ? `${settlement.Notes}\n\nAnnulation: ${reason}`
        : `Annulation: ${reason}`;
    }

    const updated = await airtableClient.update<Settlement>(
      'Settlement',
      (settlement as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update settlement - Airtable not configured');
    }
    return updated;
  }

  /**
   * Lier une transaction de trésorerie à un règlement
   */
  async linkTransaction(settlementId: string, transactionId: string): Promise<Settlement> {
    const settlements = await airtableClient.list<Settlement>('Settlement', {
      filterByFormula: `{SettlementId} = '${settlementId}'`,
    });

    if (settlements.length === 0) {
      throw new Error('Règlement non trouvé');
    }

    const settlement = settlements[0];

    const updated = await airtableClient.update<Settlement>('Settlement', (settlement as any)._recordId, {
      TransactionId: transactionId,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update settlement - Airtable not configured');
    }
    return updated;
  }

  /**
   * Obtenir les règlements en attente de paiement
   */
  async getPendingSettlements(workspaceId: string): Promise<Settlement[]> {
    return await this.list(workspaceId, { status: 'pending' });
  }

  /**
   * Obtenir les règlements d'un partenaire
   */
  async getPartnerSettlements(partnerId: string): Promise<Settlement[]> {
    const settlements = await airtableClient.list<Settlement>('Settlement', {
      filterByFormula: `{PartnerId} = '${partnerId}'`,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
    return settlements;
  }

  /**
   * Calculer le montant total dû à tous les partenaires
   */
  async getTotalDue(workspaceId: string): Promise<number> {
    const settlements = await this.list(workspaceId, { status: 'pending' });
    return settlements.reduce((sum, s) => sum + s.AmountRemaining, 0);
  }

  /**
   * Obtenir les statistiques des règlements
   */
  async getStatistics(
    workspaceId: string,
    partnerId?: string
  ): Promise<{
    totalSettlements: number;
    byStatus: Record<SettlementStatus, number>;
    totalDue: number;
    totalPaid: number;
    totalRemaining: number;
    averageSettlementAmount: number;
  }> {
    const filters: SettlementFilters = {};
    if (partnerId) filters.partnerId = partnerId;

    const settlements = await this.list(workspaceId, filters);

    const totalSettlements = settlements.length;

    // Par statut
    const byStatus: Record<SettlementStatus, number> = {
      pending: 0,
      partial: 0,
      completed: 0,
      cancelled: 0,
    };
    settlements.forEach((s) => {
      byStatus[s.Status]++;
    });

    // Totaux financiers
    const totalDue = settlements.reduce((sum, s) => sum + s.TotalDue, 0);
    const totalPaid = settlements.reduce((sum, s) => sum + s.AmountPaid, 0);
    const totalRemaining = settlements.reduce((sum, s) => sum + s.AmountRemaining, 0);

    const averageSettlementAmount = totalSettlements > 0 ? totalDue / totalSettlements : 0;

    return {
      totalSettlements,
      byStatus,
      totalDue,
      totalPaid,
      totalRemaining,
      averageSettlementAmount,
    };
  }

  /**
   * Créer un règlement automatique pour tous les rapports non payés d'un partenaire
   */
  async createAutomaticSettlement(
    partnerId: string,
    preparedById: string,
    preparedByName: string,
    workspaceId: string
  ): Promise<Settlement | null> {
    // Récupérer tous les rapports validés non encore payés
    const unpaidReports = await salesReportService.getUnpaidReports(partnerId);

    if (unpaidReports.length === 0) {
      return null; // Aucun rapport à payer
    }

    const salesReportIds = unpaidReports.map((r) => r.SalesReportId);

    return await this.create({
      partnerId,
      salesReportIds,
      preparedById,
      preparedByName,
      notes: 'Règlement automatique généré',
      workspaceId,
    });
  }

  /**
   * Obtenir les règlements en retard (non payés après X jours)
   */
  async getOverdueSettlements(workspaceId: string, daysOverdue: number = 30): Promise<Settlement[]> {
    const settlements = await this.list(workspaceId);

    const now = new Date();
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - daysOverdue);

    return settlements.filter((s) => {
      if (s.Status === 'completed' || s.Status === 'cancelled') return false;

      const createdDate = new Date(s.CreatedAt);
      return createdDate <= overdueDate;
    });
  }
}
