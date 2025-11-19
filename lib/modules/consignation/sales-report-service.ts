/**
 * Service - Gestion des Rapports de Ventes des Partenaires
 * Module Consignation & Partenaires
 */

import { AirtableClient } from '@/lib/airtable/client';
import { SalesReport, SalesReportLine, SalesReportStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { PartnerService } from './partner-service';
import { DepositService } from './deposit-service';

const airtableClient = new AirtableClient();
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
   * Générer le numéro de rapport (RAP-202511-0001)
   */
  async generateReportNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({CreatedAt}) = ${year}, MONTH({CreatedAt}) = ${parseInt(month)})`,
    });
    return `RAP-${year}${month}-${String(reports.length + 1).padStart(4, '0')}`;
  }

  /**
   * Créer un nouveau rapport de ventes
   */
  async create(input: CreateSalesReportInput): Promise<SalesReport> {
    // Validation: vérifier que le partenaire existe
    const partner = await partnerService.getById(input.partnerId);
    if (!partner) {
      throw new Error('Partenaire non trouvé');
    }

    // Validation: partenaire doit être actif
    if (partner.Status !== 'active') {
      throw new Error('Le partenaire doit être actif');
    }

    // Validation: si depositId fourni, vérifier qu'il existe
    let depositNumber: string | undefined;
    if (input.depositId) {
      const deposit = await depositService.getById(input.depositId);
      if (!deposit) {
        throw new Error('Dépôt non trouvé');
      }
      if (deposit.PartnerId !== input.partnerId) {
        throw new Error('Le dépôt n\'appartient pas à ce partenaire');
      }
      depositNumber = deposit.DepositNumber;
    }

    // Validation: au moins une ligne
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Le rapport doit contenir au moins un produit vendu');
    }

    // Validation: quantités positives
    for (const line of input.lines) {
      if (line.quantitySold <= 0) {
        throw new Error('Les quantités vendues doivent être positives');
      }
      if (line.unitPrice < 0) {
        throw new Error('Les prix unitaires doivent être positifs');
      }
    }

    const reportNumber = await this.generateReportNumber(input.workspaceId);

    // Créer les lignes de rapport
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

    const created = await airtableClient.create<SalesReport>('SalesReport', report);
    if (!created) {
      throw new Error('Failed to create sales report - Airtable not configured');
    }
    return created;
  }

  /**
   * Récupérer un rapport par son ID
   */
  async getById(reportId: string): Promise<SalesReport | null> {
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `{SalesReportId} = '${reportId}'`,
    });
    return reports.length > 0 ? reports[0] : null;
  }

  /**
   * Récupérer un rapport par son numéro
   */
  async getByNumber(reportNumber: string, workspaceId: string): Promise<SalesReport | null> {
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {ReportNumber} = '${reportNumber}')`,
    });
    return reports.length > 0 ? reports[0] : null;
  }

  /**
   * Lister les rapports avec filtres
   */
  async list(workspaceId: string, filters: SalesReportFilters = {}): Promise<SalesReport[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.partnerId) {
      filterFormulas.push(`{PartnerId} = '${filters.partnerId}'`);
    }
    if (filters.depositId) {
      filterFormulas.push(`{DepositId} = '${filters.depositId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{ReportDate} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{ReportDate} <= '${filters.endDate}'`);
    }
    if (filters.salesGenerated !== undefined) {
      filterFormulas.push(`{SalesGenerated} = ${filters.salesGenerated ? '1' : '0'}`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula,
      sort: [{ field: 'ReportDate', direction: 'desc' }],
    });
  }

  /**
   * Soumettre un rapport (passer de draft à submitted)
   */
  async submit(
    reportId: string,
    submittedById: string,
    submittedByName: string
  ): Promise<SalesReport> {
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `{SalesReportId} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouvé');
    }

    const report = reports[0];

    if (report.Status !== 'draft') {
      throw new Error('Seuls les rapports en brouillon peuvent être soumis');
    }

    const updated = await airtableClient.update<SalesReport>('SalesReport', (report as any)._recordId, {
      Status: 'submitted',
      SubmittedById: submittedById,
      SubmittedByName: submittedByName,
      SubmittedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update sales report - Airtable not configured');
    }
    return updated;
  }

  /**
   * Valider un rapport (passer de submitted à validated)
   */
  async validate(
    reportId: string,
    validatedById: string,
    validatedByName: string
  ): Promise<SalesReport> {
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `{SalesReportId} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouvé');
    }

    const report = reports[0];

    if (report.Status !== 'submitted') {
      throw new Error('Seuls les rapports soumis peuvent être validés');
    }

    // Mettre à jour les statistiques du partenaire
    await partnerService.incrementSold(report.PartnerId, report.TotalSales);

    // Si lié à un dépôt, mettre à jour les quantités vendues
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

    const updated = await airtableClient.update<SalesReport>('SalesReport', (report as any)._recordId, {
      Status: 'validated',
      ValidatedById: validatedById,
      ValidatedByName: validatedByName,
      ValidatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update sales report - Airtable not configured');
    }
    return updated;
  }

  /**
   * Rejeter un rapport
   */
  async reject(reportId: string, reason: string): Promise<SalesReport> {
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `{SalesReportId} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouvé');
    }

    const report = reports[0];

    if (report.Status !== 'submitted') {
      throw new Error('Seuls les rapports soumis peuvent être rejetés');
    }

    const updated = await airtableClient.update<SalesReport>('SalesReport', (report as any)._recordId, {
      Status: 'rejected',
      RejectionReason: reason,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update sales report - Airtable not configured');
    }
    return updated;
  }

  /**
   * Marquer comme traité (après génération des ventes)
   */
  async markAsProcessed(reportId: string, generatedSaleIds: string[]): Promise<SalesReport> {
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `{SalesReportId} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouvé');
    }

    const report = reports[0];

    if (report.Status !== 'validated') {
      throw new Error('Seuls les rapports validés peuvent être marqués comme traités');
    }

    const updated = await airtableClient.update<SalesReport>('SalesReport', (report as any)._recordId, {
      Status: 'processed',
      SalesGenerated: true,
      GeneratedSaleIds: generatedSaleIds,
      UpdatedAt: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error('Failed to update sales report - Airtable not configured');
    }
    return updated;
  }

  /**
   * Mettre à jour un rapport
   */
  async update(reportId: string, updates: UpdateSalesReportInput): Promise<SalesReport> {
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `{SalesReportId} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouvé');
    }

    const report = reports[0];

    // Validation: ne peut modifier que les rapports draft ou rejected
    if (!['draft', 'rejected'].includes(report.Status)) {
      throw new Error('Seuls les rapports en brouillon ou rejetés peuvent être modifiés');
    }

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.status !== undefined) updateData.Status = updates.status;
    if (updates.notes !== undefined) updateData.Notes = updates.notes;
    if (updates.attachments !== undefined) updateData.Attachments = updates.attachments;
    if (updates.rejectionReason !== undefined)
      updateData.RejectionReason = updates.rejectionReason;

    const updated = await airtableClient.update<SalesReport>(
      'SalesReport',
      (report as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update sales report - Airtable not configured');
    }
    return updated;
  }

  /**
   * Obtenir les rapports en attente de validation
   */
  async getPendingReports(workspaceId: string): Promise<SalesReport[]> {
    return await this.list(workspaceId, { status: 'submitted' });
  }

  /**
   * Obtenir les rapports validés non encore payés
   */
  async getUnpaidReports(partnerId: string): Promise<SalesReport[]> {
    const reports = await airtableClient.list<SalesReport>('SalesReport', {
      filterByFormula: `AND({PartnerId} = '${partnerId}', OR({Status} = 'validated', {Status} = 'processed'))`,
      sort: [{ field: 'ReportDate', direction: 'asc' }],
    });

    return reports;
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
   * Calculer le solde dû à un partenaire
   */
  async calculatePartnerBalance(partnerId: string): Promise<number> {
    const unpaidReports = await this.getUnpaidReports(partnerId);
    return unpaidReports.reduce((sum, r) => sum + r.NetAmount, 0);
  }
}
