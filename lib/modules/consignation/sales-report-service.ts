/**
 * Service - Gestion des Rapports de Ventes des Partenaires
 * Module Consignation & Partenaires
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { SalesReport, SalesReportLine, SalesReportStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { PartnerService } from './partner-service';
import { DepositService } from './deposit-service';

const postgresClient = getPostgresClient();
const partnerService = new PartnerService();
const depositService = new DepositService();

export interface CreateSalesReportLineInput {
  productId: string;
  productName: string;
  quantitySold: number;
  unitPrice: number;
  currency?: string;
}

export interface CreateSalesReportInput {
  partnerId: string;
  depositId?: string;
  periodStart: string;
  periodEnd: string;
  lines: CreateSalesReportLineInput[];
  submittedById?: string;
  submittedByName?: string;
  notes?: string;
  attachments?: string[];
  workspaceId: string;
}

export interface UpdateSalesReportInput {
  status?: SalesReportStatus;
  notes?: string;
  attachments?: string[];
  rejectionReason?: string;
}

export interface SalesReportFilters {
  partnerId?: string;
  depositId?: string;
  status?: SalesReportStatus;
  startDate?: string;
  endDate?: string;
  salesGenerated?: boolean;
}

export class SalesReportService {
  /**
   * Generer le numero de rapport (RAP-202511-0001)
   */
  async generateReportNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', YEAR({created_at}) = ${year}, MONTH({created_at}) = ${parseInt(month)})`,
    });
    return `RAP-${year}${month}-${String(reports.length + 1).padStart(4, '0')}`;
  }

  /**
   * Creer un nouveau rapport de ventes
   */
  async create(input: CreateSalesReportInput): Promise<SalesReport> {
    // Validation: verifier que le partenaire existe
    const partner = await partnerService.getById(input.partnerId);
    if (!partner) {
      throw new Error('Partenaire non trouve');
    }

    // Validation: partenaire doit etre actif
    if (partner.Status !== 'active') {
      throw new Error('Le partenaire doit etre actif');
    }

    // Validation: si depositId fourni, verifier qu'il existe
    let depositNumber: string | undefined;
    if (input.depositId) {
      const deposit = await depositService.getById(input.depositId);
      if (!deposit) {
        throw new Error('Depot non trouve');
      }
      if (deposit.PartnerId !== input.partnerId) {
        throw new Error('Le depot n\'appartient pas a ce partenaire');
      }
      depositNumber = deposit.DepositNumber;
    }

    // Validation: au moins une ligne
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Le rapport doit contenir au moins un produit vendu');
    }

    // Validation: quantites positives
    for (const line of input.lines) {
      if (line.quantitySold <= 0) {
        throw new Error('Les quantites vendues doivent etre positives');
      }
      if (line.unitPrice < 0) {
        throw new Error('Les prix unitaires doivent etre positifs');
      }
    }

    const reportNumber = await this.generateReportNumber(input.workspaceId);

    // Creer les lignes de rapport
    const lines: SalesReportLine[] = input.lines.map((line) => ({
      ReportLineId: uuidv4(),
      SalesReportId: '', // Will be set after report creation
      ProductId: line.productId,
      ProductName: line.productName,
      QuantitySold: line.quantitySold,
      UnitPrice: line.unitPrice,
      TotalAmount: line.quantitySold * line.unitPrice,
      Currency: line.currency || 'XOF',
    }));

    // Calculer les totaux
    const totalSales = lines.reduce((sum, l) => sum + l.TotalAmount, 0);
    const partnerCommission = (totalSales * partner.CommissionRate) / 100;
    const netAmount = totalSales - partnerCommission;

    const report: Partial<SalesReport> = {
      SalesReportId: uuidv4(),
      ReportNumber: reportNumber,
      PartnerId: input.partnerId,
      PartnerName: partner.Name,
      DepositId: input.depositId,
      DepositNumber: depositNumber,
      Status: input.submittedById ? 'submitted' : 'draft',
      ReportDate: new Date().toISOString(),
      PeriodStart: input.periodStart,
      PeriodEnd: input.periodEnd,
      Lines: lines,
      TotalSales: totalSales,
      PartnerCommission: partnerCommission,
      NetAmount: netAmount,
      Currency: 'XOF',
      SubmittedById: input.submittedById,
      SubmittedByName: input.submittedByName,
      SubmittedAt: input.submittedById ? new Date().toISOString() : undefined,
      SalesGenerated: false,
      Notes: input.notes,
      Attachments: input.attachments,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    // Update line IDs with report ID
    report.Lines!.forEach((line) => {
      line.SalesReportId = report.SalesReportId!;
    });

    const created = await postgresClient.create<any>('sales_reports', {
      SalesReportId: report.SalesReportId,
      ReportNumber: report.ReportNumber,
      PartnerId: report.PartnerId,
      PartnerName: report.PartnerName,
      DepositId: report.DepositId,
      DepositNumber: report.DepositNumber,
      Status: report.Status,
      ReportDate: report.ReportDate,
      PeriodStart: report.PeriodStart,
      PeriodEnd: report.PeriodEnd,
      Lines: report.Lines,
      TotalSales: report.TotalSales,
      PartnerCommission: report.PartnerCommission,
      NetAmount: report.NetAmount,
      Currency: report.Currency,
      SubmittedById: report.SubmittedById,
      SubmittedByName: report.SubmittedByName,
      SubmittedAt: report.SubmittedAt,
      SalesGenerated: report.SalesGenerated,
      Notes: report.Notes,
      Attachments: report.Attachments,
      WorkspaceId: report.WorkspaceId,
      CreatedAt: report.CreatedAt,
      UpdatedAt: report.UpdatedAt,
    });
    return this.mapToSalesReport(created);
  }

  /**
   * Recuperer un rapport par son ID
   */
  async getById(reportId: string): Promise<SalesReport | null> {
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `{sales_report_id} = '${reportId}'`,
    });
    return reports.length > 0 ? this.mapToSalesReport(reports[0]) : null;
  }

  /**
   * Recuperer un rapport par son numero
   */
  async getByNumber(reportNumber: string, workspaceId: string): Promise<SalesReport | null> {
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `AND({workspace_id} = '${workspaceId}', {report_number} = '${reportNumber}')`,
    });
    return reports.length > 0 ? this.mapToSalesReport(reports[0]) : null;
  }

  /**
   * Lister les rapports avec filtres
   */
  async list(workspaceId: string, filters: SalesReportFilters = {}): Promise<SalesReport[]> {
    const filterFormulas: string[] = [`{workspace_id} = '${workspaceId}'`];

    if (filters.partnerId) {
      filterFormulas.push(`{partner_id} = '${filters.partnerId}'`);
    }
    if (filters.depositId) {
      filterFormulas.push(`{deposit_id} = '${filters.depositId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{status} = '${filters.status}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{report_date} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{report_date} <= '${filters.endDate}'`);
    }
    if (filters.salesGenerated !== undefined) {
      filterFormulas.push(`{sales_generated} = ${filters.salesGenerated ? '1' : '0'}`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    const results = await postgresClient.list<any>('sales_reports', {
      filterByFormula,
      sort: [{ field: 'ReportDate', direction: 'desc' }],
    });
    return results.map((record: any) => this.mapToSalesReport(record));
  }

  /**
   * Soumettre un rapport (passer de draft a submitted)
   */
  async submit(
    reportId: string,
    submittedById: string,
    submittedByName: string
  ): Promise<SalesReport> {
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `{sales_report_id} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouve');
    }

    const report = this.mapToSalesReport(reports[0]);

    if (report.Status !== 'draft') {
      throw new Error('Seuls les rapports en brouillon peuvent etre soumis');
    }

    const updated = await postgresClient.update<any>('sales_reports', reports[0].id, {
      Status: 'submitted',
      SubmittedById: submittedById,
      SubmittedByName: submittedByName,
      SubmittedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
    return this.mapToSalesReport(updated);
  }

  /**
   * Valider un rapport (passer de submitted a validated)
   */
  async validate(
    reportId: string,
    validatedById: string,
    validatedByName: string
  ): Promise<SalesReport> {
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `{sales_report_id} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouve');
    }

    const report = this.mapToSalesReport(reports[0]);

    if (report.Status !== 'submitted') {
      throw new Error('Seuls les rapports soumis peuvent etre valides');
    }

    // Mettre a jour les statistiques du partenaire
    await partnerService.incrementSold(report.PartnerId, report.TotalSales);

    // Si lie a un depot, mettre a jour les quantites vendues
    if (report.DepositId) {
      for (const line of report.Lines) {
        const deposit = await depositService.getById(report.DepositId);
        if (deposit) {
          const depositLine = deposit.Lines.find((l) => l.ProductId === line.ProductId);
          if (depositLine) {
            await depositService.updateLineQuantities(
              report.DepositId,
              line.ProductId,
              depositLine.QuantitySold + line.QuantitySold,
              depositLine.QuantityReturned
            );
          }
        }
      }
    }

    const updated = await postgresClient.update<any>('sales_reports', reports[0].id, {
      Status: 'validated',
      ValidatedById: validatedById,
      ValidatedByName: validatedByName,
      ValidatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
    return this.mapToSalesReport(updated);
  }

  /**
   * Rejeter un rapport
   */
  async reject(reportId: string, reason: string): Promise<SalesReport> {
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `{sales_report_id} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouve');
    }

    const report = this.mapToSalesReport(reports[0]);

    if (report.Status !== 'submitted') {
      throw new Error('Seuls les rapports soumis peuvent etre rejetes');
    }

    const updated = await postgresClient.update<any>('sales_reports', reports[0].id, {
      Status: 'rejected',
      RejectionReason: reason,
      UpdatedAt: new Date().toISOString(),
    });
    return this.mapToSalesReport(updated);
  }

  /**
   * Marquer comme traite (apres generation des ventes)
   */
  async markAsProcessed(reportId: string, generatedSaleIds: string[]): Promise<SalesReport> {
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `{sales_report_id} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouve');
    }

    const report = this.mapToSalesReport(reports[0]);

    if (report.Status !== 'validated') {
      throw new Error('Seuls les rapports valides peuvent etre marques comme traites');
    }

    const updated = await postgresClient.update<any>('sales_reports', reports[0].id, {
      Status: 'processed',
      SalesGenerated: true,
      GeneratedSaleIds: generatedSaleIds,
      UpdatedAt: new Date().toISOString(),
    });
    return this.mapToSalesReport(updated);
  }

  /**
   * Mettre a jour un rapport
   */
  async update(reportId: string, updates: UpdateSalesReportInput): Promise<SalesReport> {
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `{sales_report_id} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouve');
    }

    const report = this.mapToSalesReport(reports[0]);

    // Validation: ne peut modifier que les rapports draft ou rejected
    if (!['draft', 'rejected'].includes(report.Status)) {
      throw new Error('Seuls les rapports en brouillon ou rejetes peuvent etre modifies');
    }

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.status !== undefined) updateData.Status = updates.status;
    if (updates.notes !== undefined) updateData.Notes = updates.notes;
    if (updates.attachments !== undefined) updateData.Attachments = updates.attachments;
    if (updates.rejectionReason !== undefined)
      updateData.RejectionReason = updates.rejectionReason;

    const updated = await postgresClient.update<any>(
      'sales_reports',
      reports[0].id,
      updateData
    );
    return this.mapToSalesReport(updated);
  }

  /**
   * Obtenir les rapports en attente de validation
   */
  async getPendingReports(workspaceId: string): Promise<SalesReport[]> {
    return await this.list(workspaceId, { status: 'submitted' });
  }

  /**
   * Obtenir les rapports valides non encore payes
   */
  async getUnpaidReports(partnerId: string): Promise<SalesReport[]> {
    const reports = await postgresClient.list<any>('sales_reports', {
      filterByFormula: `AND({partner_id} = '${partnerId}', OR({status} = 'validated', {status} = 'processed'))`,
      sort: [{ field: 'ReportDate', direction: 'asc' }],
    });

    return reports.map((record: any) => this.mapToSalesReport(record));
  }

  /**
   * Obtenir les statistiques des rapports
   */
  async getStatistics(
    workspaceId: string,
    partnerId?: string
  ): Promise<{
    totalReports: number;
    byStatus: Record<SalesReportStatus, number>;
    totalSales: number;
    totalCommission: number;
    totalNetAmount: number;
    averageSalesPerReport: number;
    reportsWithSalesGenerated: number;
  }> {
    const filters: SalesReportFilters = {};
    if (partnerId) filters.partnerId = partnerId;

    const reports = await this.list(workspaceId, filters);

    const totalReports = reports.length;

    // Par statut
    const byStatus: Record<SalesReportStatus, number> = {
      draft: 0,
      submitted: 0,
      validated: 0,
      processed: 0,
      rejected: 0,
    };
    reports.forEach((r) => {
      byStatus[r.Status]++;
    });

    // Totaux financiers
    const totalSales = reports.reduce((sum, r) => sum + r.TotalSales, 0);
    const totalCommission = reports.reduce((sum, r) => sum + r.PartnerCommission, 0);
    const totalNetAmount = reports.reduce((sum, r) => sum + r.NetAmount, 0);

    const averageSalesPerReport = totalReports > 0 ? totalSales / totalReports : 0;

    const reportsWithSalesGenerated = reports.filter((r) => r.SalesGenerated).length;

    return {
      totalReports,
      byStatus,
      totalSales,
      totalCommission,
      totalNetAmount,
      averageSalesPerReport,
      reportsWithSalesGenerated,
    };
  }

  /**
   * Calculer le solde du a un partenaire
   */
  async calculatePartnerBalance(partnerId: string): Promise<number> {
    const unpaidReports = await this.getUnpaidReports(partnerId);
    return unpaidReports.reduce((sum, r) => sum + r.NetAmount, 0);
  }

  /**
   * Map database record to SalesReport type
   */
  private mapToSalesReport(record: any): SalesReport {
    return {
      SalesReportId: record.sales_report_id,
      ReportNumber: record.report_number,
      PartnerId: record.partner_id,
      PartnerName: record.partner_name,
      DepositId: record.deposit_id,
      DepositNumber: record.deposit_number,
      Status: record.status,
      ReportDate: record.report_date,
      PeriodStart: record.period_start,
      PeriodEnd: record.period_end,
      Lines: record.lines,
      TotalSales: record.total_sales,
      PartnerCommission: record.partner_commission,
      NetAmount: record.net_amount,
      Currency: record.currency,
      SubmittedById: record.submitted_by_id,
      SubmittedByName: record.submitted_by_name,
      SubmittedAt: record.submitted_at,
      ValidatedById: record.validated_by_id,
      ValidatedByName: record.validated_by_name,
      ValidatedAt: record.validated_at,
      SalesGenerated: record.sales_generated,
      GeneratedSaleIds: record.generated_sale_ids,
      RejectionReason: record.rejection_reason,
      Notes: record.notes,
      Attachments: record.attachments,
      WorkspaceId: record.workspace_id,
      CreatedAt: record.created_at,
      UpdatedAt: record.updated_at,
    };
  }
}
