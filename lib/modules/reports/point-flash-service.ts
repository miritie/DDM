/**
 * Service - Point Flash Automatisé
 * Génération automatique du Point Flash hebdomadaire (dimanche 19h)
 * Calcul des KPIs, génération PDF, transmission WhatsApp
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Sale, Expense, Product, Employee, Transaction } from '@/types/modules';
import { PDFGeneratorService, PDFPointFlash } from './pdf-generator-service';
import { WhatsAppReportService } from './whatsapp-report-service';

const airtableClient = new AirtableClient();
const pdfGenerator = new PDFGeneratorService();
const whatsappService = new WhatsAppReportService();

export interface PointFlashConfig {
  enabled: boolean;
  schedule: {
    dayOfWeek: number; // 0 = dimanche
    hour: number; // 19
    minute: number; // 0
  };
  whatsappGroups: string[]; // IDs des groupes WhatsApp
  includePDF: boolean;
  sendTextSummary: boolean;
  recipients?: string[]; // Emails (future)
}

export interface PointFlashData {
  week: string;
  period: { start: string; end: string };
  kpis: {
    revenue: { value: number; trend: number; target?: number };
    expenses: { value: number; trend: number; budget?: number };
    profit: { value: number; trend: number };
    cashBalance: { value: number; trend: number };
    salesCount: { value: number; trend: number };
    newCustomers: { value: number };
    productivity: { value: number; trend: number };
  };
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  topSalespersons?: Array<{ name: string; salesCount: number; revenue: number }>;
  alerts?: Array<{ type: 'success' | 'warning' | 'error'; message: string }>;
  objectives?: Array<{ label: string; achieved: number; target: number; progress: number }>;
}

export class PointFlashService {
  /**
   * Génère le Point Flash pour la période donnée
   */
  async generatePointFlash(
    workspaceId: string,
    startDate: string,
    endDate: string,
    weekLabel?: string
  ): Promise<PointFlashData> {
    // Calculer la semaine si non fournie
    const week = weekLabel || this.getWeekLabel(new Date(startDate));

    // Calculer la période précédente (même durée)
    const periodDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const previousStartDate = new Date(
      new Date(startDate).getTime() - periodDays * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split('T')[0];
    const previousEndDate = new Date(
      new Date(endDate).getTime() - periodDays * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split('T')[0];

    // Récupérer les données en parallèle
    const [
      sales,
      expenses,
      transactions,
      products,
      previousSales,
      previousExpenses,
      previousTransactions,
    ] = await Promise.all([
      this.getSales(workspaceId, startDate, endDate),
      this.getExpenses(workspaceId, startDate, endDate),
      this.getTransactions(workspaceId, startDate, endDate),
      this.getProducts(workspaceId),
      this.getSales(workspaceId, previousStartDate, previousEndDate),
      this.getExpenses(workspaceId, previousStartDate, previousEndDate),
      this.getTransactions(workspaceId, previousStartDate, previousEndDate),
    ]);

    // Calculer KPIs
    const revenue = sales.reduce((sum, s) => sum + s.TotalAmount, 0);
    const previousRevenue = previousSales.reduce((sum, s) => sum + s.TotalAmount, 0);
    const revenueTrend = this.calculateTrend(revenue, previousRevenue);

    const expensesTotal = expenses.reduce((sum, e) => sum + e.Amount, 0);
    const previousExpensesTotal = previousExpenses.reduce((sum, e) => sum + e.Amount, 0);
    const expensesTrend = this.calculateTrend(expensesTotal, previousExpensesTotal);

    const profit = revenue - expensesTotal;
    const previousProfit = previousRevenue - previousExpensesTotal;
    const profitTrend = this.calculateTrend(profit, previousProfit);

    const cashBalance = this.calculateCashBalance(transactions);
    const previousCashBalance = this.calculateCashBalance(previousTransactions);
    const cashBalanceTrend = this.calculateTrend(cashBalance, previousCashBalance);

    const salesCount = sales.length;
    const previousSalesCount = previousSales.length;
    const salesCountTrend = this.calculateTrend(salesCount, previousSalesCount);

    const newCustomers = new Set(sales.map((s) => s.ClientId)).size;

    // Productivité = revenue / nombre de jours
    const productivity = revenue / Math.max(periodDays, 1);
    const previousProductivity = previousRevenue / Math.max(periodDays, 1);
    const productivityTrend = this.calculateTrend(productivity, previousProductivity);

    // Top produits
    const topProducts = await this.getTopProducts(workspaceId, sales);

    // Top commerciaux (si SoldBy existe)
    const topSalespersons = await this.getTopSalespersons(workspaceId, sales);

    // Alertes automatiques
    const alerts = this.generateAlerts({
      revenue,
      revenueTrend,
      expensesTotal,
      expensesTrend,
      profit,
      profitTrend,
      cashBalance,
      salesCount,
    });

    // Objectifs (TODO: récupérer depuis config)
    const objectives = [
      {
        label: 'Chiffre d\'affaires hebdomadaire',
        achieved: revenue,
        target: 10000000, // 10M FCFA
        progress: (revenue / 10000000) * 100,
      },
      {
        label: 'Nombre de ventes',
        achieved: salesCount,
        target: 100,
        progress: (salesCount / 100) * 100,
      },
    ];

    return {
      week,
      period: { start: startDate, end: endDate },
      kpis: {
        revenue: { value: revenue, trend: revenueTrend },
        expenses: { value: expensesTotal, trend: expensesTrend },
        profit: { value: profit, trend: profitTrend },
        cashBalance: { value: cashBalance, trend: cashBalanceTrend },
        salesCount: { value: salesCount, trend: salesCountTrend },
        newCustomers: { value: newCustomers },
        productivity: { value: productivity, trend: productivityTrend },
      },
      topProducts,
      topSalespersons: topSalespersons.length > 0 ? topSalespersons : undefined,
      alerts: alerts.length > 0 ? alerts : undefined,
      objectives,
    };
  }

  /**
   * Génère et envoie le Point Flash automatiquement
   */
  async generateAndSendPointFlash(
    workspaceId: string,
    config: PointFlashConfig
  ): Promise<{ success: boolean; pdfUrl?: string; sentTo?: string[] }> {
    // Calculer la période de la semaine passée (lundi-dimanche)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - ((endDate.getDay() + 6) % 7) - 1); // Dimanche dernier
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6); // Lundi de la semaine

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Générer les données
    const pointFlashData = await this.generatePointFlash(workspaceId, startDateStr, endDateStr);

    let pdfUrl: string | undefined;

    // Générer le PDF si demandé
    if (config.includePDF) {
      const pdfData: PDFPointFlash = {
        ...pointFlashData,
        generatedAt: new Date().toISOString(),
        signature: {
          name: 'Direction Générale',
          role: 'DG',
          date: new Date().toISOString(),
          simulatedSignature: true,
        },
      };

      const pdfBlob = await pdfGenerator.generatePointFlashPDF(pdfData);

      // TODO: Upload le PDF quelque part (S3, Cloudinary, etc.) et récupérer l'URL
      // Pour l'instant, on simule
      pdfUrl = 'https://example.com/point-flash.pdf';
    }

    // Envoyer via WhatsApp si configuré
    let sentTo: string[] = [];

    if (config.whatsappGroups.length > 0 && whatsappService.isConfigured()) {
      const result = await whatsappService.sendPointFlash({
        period: pointFlashData.week,
        kpis: {
          revenue: pointFlashData.kpis.revenue.value,
          revenueTrend: pointFlashData.kpis.revenue.trend,
          expenses: pointFlashData.kpis.expenses.value,
          expensesTrend: pointFlashData.kpis.expenses.trend,
          profit: pointFlashData.kpis.profit.value,
          profitTrend: pointFlashData.kpis.profit.trend,
          salesCount: pointFlashData.kpis.salesCount.value,
          newCustomers: pointFlashData.kpis.newCustomers.value,
        },
        alerts: pointFlashData.alerts?.map((a) => a.message),
        pdfUrl: config.includePDF ? pdfUrl : undefined,
        targetGroups: config.whatsappGroups,
      });

      sentTo = result.sentTo;
    }

    return {
      success: true,
      pdfUrl,
      sentTo,
    };
  }

  /**
   * Vérifie si on doit générer le Point Flash maintenant
   */
  shouldGenerateNow(config: PointFlashConfig): boolean {
    if (!config.enabled) return false;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    return (
      dayOfWeek === config.schedule.dayOfWeek &&
      hour === config.schedule.hour &&
      minute >= config.schedule.minute &&
      minute < config.schedule.minute + 5 // Fenêtre de 5 minutes
    );
  }

  // ============ Méthodes privées ============

  private async getSales(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<Sale[]> {
    return await airtableClient.list<Sale>('Sale', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {SaleDate} >= '${startDate}', {SaleDate} <= '${endDate}', {Status} != 'cancelled')`,
    });
  }

  private async getExpenses(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<Expense[]> {
    return await airtableClient.list<Expense>('Expense', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {CreatedAt} >= '${startDate}', {CreatedAt} <= '${endDate}', {Status} = 'paid')`,
    });
  }

  private async getTransactions(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    return await airtableClient.list<Transaction>('Transaction', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {ProcessedAt} >= '${startDate}', {ProcessedAt} <= '${endDate}')`,
    });
  }

  private async getProducts(workspaceId: string): Promise<Product[]> {
    return await airtableClient.list<Product>('Product', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {IsActive} = 1)`,
    });
  }

  private calculateCashBalance(transactions: Transaction[]): number {
    return transactions.reduce((sum, t) => {
      if (t.Type === 'income') return sum + t.Amount;
      if (t.Type === 'expense') return sum - t.Amount;
      return sum;
    }, 0);
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private async getTopProducts(
    workspaceId: string,
    sales: Sale[]
  ): Promise<Array<{ name: string; quantity: number; revenue: number }>> {
    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const sale of sales) {
      const lines = await airtableClient.list<any>('SaleLine', {
        filterByFormula: `{SaleId} = '${sale.SaleId}'`,
      });

      for (const line of lines) {
        const products = await airtableClient.list<Product>('Product', {
          filterByFormula: `{ProductId} = '${line.ProductId}'`,
        });

        if (products.length > 0) {
          const product = products[0];
          const key = product.ProductId;

          if (!productStats.has(key)) {
            productStats.set(key, {
              name: product.Name,
              quantity: 0,
              revenue: 0,
            });
          }

          productStats.get(key)!.quantity += line.Quantity;
          productStats.get(key)!.revenue += line.TotalPrice;
        }
      }
    }

    return Array.from(productStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  private async getTopSalespersons(
    workspaceId: string,
    sales: Sale[]
  ): Promise<Array<{ name: string; salesCount: number; revenue: number }>> {
    const salespersonStats = new Map<
      string,
      { name: string; salesCount: number; revenue: number }
    >();

    for (const sale of sales) {
      if (!sale.SoldBy) continue;

      const employees = await airtableClient.list<Employee>('Employee', {
        filterByFormula: `{EmployeeId} = '${sale.SoldBy}'`,
      });

      if (employees.length > 0) {
        const employee = employees[0];
        const key = employee.EmployeeId;

        if (!salespersonStats.has(key)) {
          salespersonStats.set(key, {
            name: employee.FullName,
            salesCount: 0,
            revenue: 0,
          });
        }

        salespersonStats.get(key)!.salesCount += 1;
        salespersonStats.get(key)!.revenue += sale.TotalAmount;
      }
    }

    return Array.from(salespersonStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  private generateAlerts(data: {
    revenue: number;
    revenueTrend: number;
    expensesTotal: number;
    expensesTrend: number;
    profit: number;
    profitTrend: number;
    cashBalance: number;
    salesCount: number;
  }): Array<{ type: 'success' | 'warning' | 'error'; message: string }> {
    const alerts: Array<{ type: 'success' | 'warning' | 'error'; message: string }> = [];

    // Alerte croissance CA
    if (data.revenueTrend > 20) {
      alerts.push({
        type: 'success',
        message: `Excellente performance ! CA en hausse de ${data.revenueTrend.toFixed(1)}%`,
      });
    } else if (data.revenueTrend < -20) {
      alerts.push({
        type: 'error',
        message: `Attention ! CA en baisse de ${Math.abs(data.revenueTrend).toFixed(1)}%`,
      });
    }

    // Alerte dépenses
    if (data.expensesTrend > 30) {
      alerts.push({
        type: 'warning',
        message: `Dépenses en forte hausse (+${data.expensesTrend.toFixed(1)}%). Vérifier les postes de dépense`,
      });
    }

    // Alerte profitabilité
    if (data.profit < 0) {
      alerts.push({
        type: 'error',
        message: 'Bénéfice négatif ! Actions urgentes requises',
      });
    } else if (data.profitTrend < -50) {
      alerts.push({
        type: 'warning',
        message: `Bénéfice en forte baisse (${data.profitTrend.toFixed(1)}%)`,
      });
    }

    // Alerte trésorerie
    if (data.cashBalance < 0) {
      alerts.push({
        type: 'error',
        message: 'Trésorerie négative ! Risque de découvert',
      });
    } else if (data.cashBalance < 1000000) {
      alerts.push({
        type: 'warning',
        message: 'Trésorerie faible. Anticiper les besoins de cash',
      });
    }

    // Alerte activité
    if (data.salesCount < 10) {
      alerts.push({
        type: 'warning',
        message: `Faible activité commerciale (${data.salesCount} ventes). Relancer les efforts commerciaux`,
      });
    }

    return alerts;
  }

  private getWeekLabel(date: Date): string {
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);

    return `Semaine ${weekNumber} - ${date.getFullYear()}`;
  }
}
