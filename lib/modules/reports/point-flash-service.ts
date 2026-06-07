/**
 * Service - Point Flash Automatise
 * Generation automatique du Point Flash hebdomadaire (dimanche 19h)
 * Calcul des KPIs, generation PDF, transmission WhatsApp
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Sale, Expense, Product, Employee, Transaction } from '@/types/modules';
import { PDFGeneratorService, PDFPointFlash } from './pdf-generator-service';
import { WhatsAppReportService } from './whatsapp-report-service';

const postgresClient = getPostgresClient();
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
   * Genere le Point Flash pour la periode donnee
   */
  async generatePointFlash(
    workspaceId: string,
    startDate: string,
    endDate: string,
    weekLabel?: string
  ): Promise<PointFlashData> {
    // Calculer la semaine si non fournie
    const week = weekLabel || this.getWeekLabel(new Date(startDate));

    // Calculer la periode precedente (meme duree)
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

    // Recuperer les donnees en parallele
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

    // Productivite = revenue / nombre de jours
    const productivity = revenue / Math.max(periodDays, 1);
    const previousProductivity = previousRevenue / Math.max(periodDays, 1);
    const productivityTrend = this.calculateTrend(productivity, previousProductivity);

    // Top produits
    const topProducts = await this.getTopProducts(workspaceId, startDate, endDate);

    // Top commerciaux
    const topSalespersons = await this.getTopSalespersons(workspaceId, startDate, endDate);

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

    // Objectifs (TODO: recuperer depuis config)
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
   * Genere et envoie le Point Flash automatiquement
   */
  async generateAndSendPointFlash(
    workspaceId: string,
    config: PointFlashConfig
  ): Promise<{ success: boolean; pdfUrl?: string; sentTo?: string[] }> {
    // Calculer la periode de la semaine passee (lundi-dimanche)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - ((endDate.getDay() + 6) % 7) - 1); // Dimanche dernier
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6); // Lundi de la semaine

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Generer les donnees
    const pointFlashData = await this.generatePointFlash(workspaceId, startDateStr, endDateStr);

    let pdfUrl: string | undefined;

    // Generer le PDF si demande
    if (config.includePDF) {
      const pdfData: PDFPointFlash = {
        ...pointFlashData,
        generatedAt: new Date().toISOString(),
        signature: {
          name: 'Direction Generale',
          role: 'DG',
          date: new Date().toISOString(),
          simulatedSignature: true,
        },
      };

      const pdfBlob = await pdfGenerator.generatePointFlashPDF(pdfData);

      // TODO: Upload le PDF quelque part (S3, Cloudinary, etc.) et recuperer l'URL
      // Pour l'instant, on simule
      pdfUrl = 'https://example.com/point-flash.pdf';
    }

    // Envoyer via WhatsApp si configure
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
   * Verifie si on doit generer le Point Flash maintenant
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
      minute < config.schedule.minute + 5 // Fenetre de 5 minutes
    );
  }

  // ============ Methodes privees ============

  // Filtres réécrits en SQL paramétré : les formules sans accolades
  // étaient silencieusement ignorées (lecture de table entière).
  private async getSales(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<Sale[]> {
    return await postgresClient.listWhere<Sale>(
      'sales',
      `workspace_id = $1 AND sale_date >= $2 AND sale_date < ($3::date + 1) AND status != 'cancelled'`,
      [workspaceId, startDate, endDate]
    );
  }

  private async getExpenses(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<Expense[]> {
    return await postgresClient.listWhere<Expense>(
      'expenses',
      `workspace_id = $1 AND created_at >= $2 AND created_at < ($3::date + 1) AND status = 'paid'`,
      [workspaceId, startDate, endDate]
    );
  }

  private async getTransactions(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    return await postgresClient.listWhere<Transaction>(
      'transactions',
      `workspace_id = $1 AND processed_at >= $2 AND processed_at < ($3::date + 1)`,
      [workspaceId, startDate, endDate]
    );
  }

  private async getProducts(workspaceId: string): Promise<Product[]> {
    return await postgresClient.list<Product>('products', {
      where: { workspace_id: workspaceId, is_active: true },
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

  // Agrégat SQL direct — l'ancien code lisait « sale_lines » (table
  // inexistante, la vraie est sale_items) en N+1 par vente.
  private async getTopProducts(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ name: string; quantity: number; revenue: number }>> {
    const result = await postgresClient.query(
      `SELECT COALESCE(p.name, si.product_name) AS name,
              SUM(si.quantity)::float AS quantity,
              SUM(si.total_price)::float AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.sale_date < ($3::date + 1)
         AND s.status != 'cancelled'
       GROUP BY COALESCE(p.name, si.product_name)
       ORDER BY revenue DESC
       LIMIT 5`,
      [workspaceId, startDate, endDate]
    );
    return result.rows;
  }

  // sales_person_id référence users(id) — l'ancien code cherchait dans
  // employees par employee_id : aucune correspondance possible.
  private async getTopSalespersons(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ name: string; salesCount: number; revenue: number }>> {
    const result = await postgresClient.query(
      `SELECT COALESCE(u.full_name, u.username, 'Inconnu') AS name,
              COUNT(*)::int AS "salesCount",
              SUM(s.total_amount)::float AS revenue
       FROM sales s
       JOIN users u ON u.id = s.sales_person_id
       WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.sale_date < ($3::date + 1)
         AND s.status != 'cancelled'
       GROUP BY COALESCE(u.full_name, u.username, 'Inconnu')
       ORDER BY revenue DESC
       LIMIT 5`,
      [workspaceId, startDate, endDate]
    );
    return result.rows;
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

    // Alerte depenses
    if (data.expensesTrend > 30) {
      alerts.push({
        type: 'warning',
        message: `Depenses en forte hausse (+${data.expensesTrend.toFixed(1)}%). Verifier les postes de depense`,
      });
    }

    // Alerte profitabilite
    if (data.profit < 0) {
      alerts.push({
        type: 'error',
        message: 'Benefice negatif ! Actions urgentes requises',
      });
    } else if (data.profitTrend < -50) {
      alerts.push({
        type: 'warning',
        message: `Benefice en forte baisse (${data.profitTrend.toFixed(1)}%)`,
      });
    }

    // Alerte tresorerie
    if (data.cashBalance < 0) {
      alerts.push({
        type: 'error',
        message: 'Tresorerie negative ! Risque de decouvert',
      });
    } else if (data.cashBalance < 1000000) {
      alerts.push({
        type: 'warning',
        message: 'Tresorerie faible. Anticiper les besoins de cash',
      });
    }

    // Alerte activite
    if (data.salesCount < 10) {
      alerts.push({
        type: 'warning',
        message: `Faible activite commerciale (${data.salesCount} ventes). Relancer les efforts commerciaux`,
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
