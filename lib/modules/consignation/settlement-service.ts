/**
 * Service - Gestion des Reglements aux Partenaires
 * Module Consignation & Partenaires
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Settlement, SettlementStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { PartnerService } from './partner-service';
import { SalesReportService } from './sales-report-service';

const postgresClient = getPostgresClient();
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
   * Generer le numero de reglement (SET-202511-0001)
   */
  async generateSettlementNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const settlements = await postgresClient.list<any>('settlements', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', YEAR({created_at}) = ${year}, MONTH({created_at}) = ${parseInt(month)})`,
    });
    return `SET-${year}${month}-${String(settlements.length + 1).padStart(4, '0')}`;
  }

  /**
   * Creer un nouveau reglement
   */
  async create(input: CreateSettlementInput): Promise<Settlement> {
    // Validation: verifier que le partenaire existe
    const partner = await partnerService.getById(input.partnerId);
    if (!partner) {
      throw new Error('Partenaire non trouve');
    }

    // Validation: au moins un rapport de ventes
    if (!input.salesReportIds || input.salesReportIds.length === 0) {
      throw new Error('Le reglement doit inclure au moins un rapport de ventes');
    }

    // Validation: verifier que tous les rapports existent et appartiennent au partenaire
    let totalDue = 0;
    for (const reportId of input.salesReportIds) {
      const report = await salesReportService.getById(reportId);
      if (!report) {
        throw new Error(`Rapport de ventes ${reportId} non trouve`);
      }
      if (report.PartnerId !== input.partnerId) {
        throw new Error(`Le rapport ${report.ReportNumber} n'appartient pas a ce partenaire`);
      }
      if (!['validated', 'processed'].includes(report.Status)) {
        throw new Error(
          `Le rapport ${report.ReportNumber} doit etre valide ou traite pour etre inclus dans un reglement`
        );
      }
      totalDue += report.NetAmount;
    }

    const settlementNumber = await this.generateSettlementNumber(input.workspaceId);

    const settlement: any = {
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

    const created = await postgresClient.create<any>('settlements', settlement);
    return this.mapToSettlement(created);
  }

  /**
   * Recuperer un reglement par son ID
   */
  async getById(settlementId: string): Promise<Settlement | null> {
    const settlements = await postgresClient.list<any>('settlements', {
      filterByFormula: `{settlement_id} = '${settlementId}'`,
    });
    return settlements.length > 0 ? this.mapToSettlement(settlements[0]) : null;
  }

  /**
   * Recuperer un reglement par son numero
   */
  async getByNumber(settlementNumber: string, workspaceId: string): Promise<Settlement | null> {
    const settlements = await postgresClient.list<any>('settlements', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', {settlement_number} = '${settlementNumber}')`,
    });
    return settlements.length > 0 ? this.mapToSettlement(settlements[0]) : null;
  }

  /**
   * Lister les reglements avec filtres
   */
  async list(workspaceId: string, filters: SettlementFilters = {}): Promise<Settlement[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.partnerId) {
      filterFormulas.push(`{partner_id} = '${filters.partnerId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{status} = '${filters.status}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{created_at} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{created_at} <= '${filters.endDate}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    const results = await postgresClient.list<any>('settlements', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
    return results.map((record: any) => this.mapToSettlement(record));
  }

  /**
   * Payer un reglement (complet ou partiel)
   */
  async pay(settlementId: string, input: PaySettlementInput): Promise<Settlement> {
    const settlements = await postgresClient.list<any>('settlements', {
      filterByFormula: `{settlement_id} = '${settlementId}'`,
    });

    if (settlements.length === 0) {
      throw new Error('Reglement non trouve');
    }

    const settlement = this.mapToSettlement(settlements[0]);

    if (settlement.Status === 'completed') {
      throw new Error('Ce reglement a deja ete paye integralement');
    }

    if (settlement.Status === 'cancelled') {
      throw new Error('Impossible de payer un reglement annule');
    }

    // Montant a payer (par defaut: le restant, sinon le montant specifie)
    const paymentAmount = input.amount || settlement.AmountRemaining;

    // Validation: montant ne doit pas depasser le restant
    if (paymentAmount > settlement.AmountRemaining) {
      throw new Error('Le montant a payer depasse le montant restant');
    }

    // Validation: montant positif
    if (paymentAmount <= 0) {
      throw new Error('Le montant a payer doit etre positif');
    }

    const newAmountPaid = settlement.AmountPaid + paymentAmount;
    const newAmountRemaining = settlement.TotalDue - newAmountPaid;

    // Determiner le nouveau statut
    let newStatus: SettlementStatus;
    if (newAmountRemaining === 0) {
      newStatus = 'completed';
    } else if (newAmountPaid > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'pending';
    }

    // Mettre a jour le solde du partenaire
    await partnerService.pay(settlement.PartnerId, paymentAmount);

    // Mettre a jour le reglement
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

    const updated = await postgresClient.update<any>(
      'settlements',
      settlements[0].id,
      updateData
    );
    return this.mapToSettlement(updated);
  }

  /**
   * Annuler un reglement
   */
  async cancel(settlementId: string, reason?: string): Promise<Settlement> {
    const settlements = await postgresClient.list<any>('settlements', {
      filterByFormula: `{settlement_id} = '${settlementId}'`,
    });

    if (settlements.length === 0) {
      throw new Error('Reglement non trouve');
    }

    const settlement = this.mapToSettlement(settlements[0]);

    if (settlement.Status === 'completed') {
      throw new Error('Impossible d\'annuler un reglement deja paye integralement');
    }

    // Si deja partiellement paye, ajuster le solde du partenaire
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

    const updated = await postgresClient.update<any>(
      'settlements',
      settlements[0].id,
      updateData
    );
    return this.mapToSettlement(updated);
  }

  /**
   * Lier une transaction de tresorerie a un reglement
   */
  async linkTransaction(settlementId: string, transactionId: string): Promise<Settlement> {
    const settlements = await postgresClient.list<any>('settlements', {
      filterByFormula: `{settlement_id} = '${settlementId}'`,
    });

    if (settlements.length === 0) {
      throw new Error('Reglement non trouve');
    }

    const updated = await postgresClient.update<any>('settlements', settlements[0].id, {
      TransactionId: transactionId,
      UpdatedAt: new Date().toISOString(),
    });
    return this.mapToSettlement(updated);
  }

  /**
   * Obtenir les reglements en attente de paiement
   */
  async getPendingSettlements(workspaceId: string): Promise<Settlement[]> {
    return await this.list(workspaceId, { status: 'pending' });
  }

  /**
   * Obtenir les reglements d'un partenaire
   */
  async getPartnerSettlements(partnerId: string): Promise<Settlement[]> {
    const settlements = await postgresClient.list<any>('settlements', {
      filterByFormula: `{partner_id} = '${partnerId}'`,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
    return settlements.map((record: any) => this.mapToSettlement(record));
  }

  /**
   * Calculer le montant total du a tous les partenaires
   */
  async getTotalDue(workspaceId: string): Promise<number> {
    const settlements = await this.list(workspaceId, { status: 'pending' });
    return settlements.reduce((sum, s) => sum + s.AmountRemaining, 0);
  }

  /**
   * Obtenir les statistiques des reglements
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
   * Creer un reglement automatique pour tous les rapports non payes d'un partenaire
   */
  async createAutomaticSettlement(
    partnerId: string,
    preparedById: string,
    preparedByName: string,
    workspaceId: string
  ): Promise<Settlement | null> {
    // Recuperer tous les rapports valides non encore payes
    const unpaidReports = await salesReportService.getUnpaidReports(partnerId);

    if (unpaidReports.length === 0) {
      return null; // Aucun rapport a payer
    }

    const salesReportIds = unpaidReports.map((r) => r.SalesReportId);

    return await this.create({
      partnerId,
      salesReportIds,
      preparedById,
      preparedByName,
      notes: 'Reglement automatique genere',
      workspaceId,
    });
  }

  /**
   * Obtenir les reglements en retard (non payes apres X jours)
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

  /**
   * Map database record to Settlement type
   */
  private mapToSettlement(record: any): Settlement {
    return {
      SettlementId: record.settlement_id,
      SettlementNumber: record.settlement_number,
      PartnerId: record.partner_id,
      PartnerName: record.partner_name,
      Status: record.status,
      TotalDue: record.total_due,
      AmountPaid: record.amount_paid,
      AmountRemaining: record.amount_remaining,
      Currency: record.currency,
      SalesReportIds: record.sales_report_ids,
      PreparedById: record.prepared_by_id,
      PreparedByName: record.prepared_by_name,
      PaymentMethod: record.payment_method,
      PaymentDate: record.payment_date,
      PaymentProof: record.payment_proof,
      WalletId: record.wallet_id,
      PaidById: record.paid_by_id,
      PaidByName: record.paid_by_name,
      TransactionId: record.transaction_id,
      Notes: record.notes,
      WorkspaceId: record.workspace_id,
      CreatedAt: record.created_at,
      UpdatedAt: record.updated_at,
    };
  }
}
