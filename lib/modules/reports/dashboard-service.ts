/**
 * Service - Dashboard Global avec KPIs
 * Module Rapports & Analytics
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import {
  GlobalDashboard,
  DashboardKPI,
  ChartData,
  Sale,
  Expense,
  Transaction,
  Product,
  Employee
} from '@/types/modules';

const postgresClient = getPostgresClient();

/**
 * Pg renvoie les TIMESTAMP en `Date`, l'ancien code Airtable s'attendait à des strings ISO.
 * Renvoie la forme `YYYY-MM-DD[THH:mm:ss...]` pour pouvoir appeler .substring() dessus.
 */
function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export class DashboardService {
  /**
   * Generate global dashboard with KPIs and charts
   */
  async getGlobalDashboard(
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<GlobalDashboard> {
    // Fetch data from all modules in parallel
    const [sales, expenses, transactions, products, employees] = await Promise.all([
      this.getSalesData(workspaceId, startDate, endDate),
      this.getExpensesData(workspaceId, startDate, endDate),
      this.getTransactionsData(workspaceId, startDate, endDate),
      this.getProductsData(workspaceId),
      this.getEmployeesData(workspaceId),
    ]);

    // Calculate previous period for comparison
    const periodDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(new Date(startDate).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const previousEndDate = new Date(new Date(endDate).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [previousSales, previousExpenses] = await Promise.all([
      this.getSalesData(workspaceId, previousStartDate, previousEndDate),
      this.getExpensesData(workspaceId, previousStartDate, previousEndDate),
    ]);

    // Calculate KPIs
    const revenue = sales.reduce((sum, s) => sum + s.TotalAmount, 0);
    const previousRevenue = previousSales.reduce((sum, s) => sum + s.TotalAmount, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.Amount, 0);
    const previousTotalExpenses = previousExpenses.reduce((sum, e) => sum + e.Amount, 0);

    const profit = revenue - totalExpenses;
    const previousProfit = previousRevenue - previousTotalExpenses;

    const cashBalance = transactions.reduce((sum, t) =>
      sum + (t.Type === 'income' ? t.Amount : t.Type === 'expense' ? -t.Amount : 0), 0
    );

    const kpis = {
      revenue: this.createKPI('Chiffre d\'affaires', revenue, previousRevenue, 'currency'),
      expenses: this.createKPI('Depenses', totalExpenses, previousTotalExpenses, 'currency'),
      profit: this.createKPI('Benefice net', profit, previousProfit, 'currency'),
      cashBalance: this.createKPI('Tresorerie', cashBalance, undefined, 'currency'),
      sales: this.createKPI('Ventes', sales.length, previousSales.length, 'number'),
      customers: this.createKPI('Clients actifs', new Set(sales.map(s => s.ClientId)).size, undefined, 'number'),
      inventory: this.createKPI('Produits actifs', products.length, undefined, 'number'),
      employees: this.createKPI('Employes', employees.length, undefined, 'number'),
    };

    // Generate charts
    const charts = {
      revenueVsExpenses: await this.getRevenueVsExpensesChart(workspaceId, startDate, endDate),
      salesTrend: await this.getSalesTrendChart(workspaceId, startDate, endDate),
      cashflowTrend: await this.getCashflowTrendChart(workspaceId, startDate, endDate),
      topProducts: await this.getTopProductsChart(workspaceId, startDate, endDate),
      expensesByCategory: await this.getExpensesByCategoryChart(workspaceId, startDate, endDate),
    };

    return {
      period: { start: startDate, end: endDate },
      kpis,
      charts,
    };
  }

  private createKPI(
    label: string,
    value: number,
    previousValue: number | undefined,
    format: 'currency' | 'number' | 'percentage'
  ): DashboardKPI {
    let change = 0;
    let changePercent = 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';

    if (previousValue !== undefined && previousValue !== 0) {
      change = value - previousValue;
      changePercent = (change / previousValue) * 100;
      trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    }

    return {
      kpiId: `kpi-${label.toLowerCase().replace(/\s+/g, '-')}`,
      label,
      value,
      previousValue,
      change,
      changePercent,
      trend,
      format,
    };
  }

  // NB : ces filtres étaient en filterByFormula SANS accolades — le parseur
  // les ignorait silencieusement et chaque « période » lisait la table
  // entière. Réécrits en SQL paramétré (borne de fin inclusive).
  private async getSalesData(workspaceId: string, startDate: string, endDate: string): Promise<Sale[]> {
    return await postgresClient.listWhere<Sale>(
      'sales',
      `workspace_id = $1 AND sale_date >= $2 AND sale_date < ($3::date + 1) AND status != 'cancelled'`,
      [workspaceId, startDate, endDate]
    );
  }

  private async getExpensesData(workspaceId: string, startDate: string, endDate: string): Promise<Expense[]> {
    return await postgresClient.listWhere<Expense>(
      'expenses',
      `workspace_id = $1 AND created_at >= $2 AND created_at < ($3::date + 1) AND status = 'paid'`,
      [workspaceId, startDate, endDate]
    );
  }

  private async getTransactionsData(workspaceId: string, startDate: string, endDate: string): Promise<Transaction[]> {
    return await postgresClient.listWhere<Transaction>(
      'transactions',
      `workspace_id = $1 AND processed_at >= $2 AND processed_at < ($3::date + 1)`,
      [workspaceId, startDate, endDate]
    );
  }

  private async getProductsData(workspaceId: string): Promise<Product[]> {
    return await postgresClient.list<Product>('products', {
      where: { workspace_id: workspaceId, is_active: true },
    });
  }

  private async getEmployeesData(workspaceId: string): Promise<Employee[]> {
    return await postgresClient.list<Employee>('employees', {
      where: { workspace_id: workspaceId, status: 'active' },
    });
  }

  private async getRevenueVsExpensesChart(workspaceId: string, startDate: string, endDate: string): Promise<ChartData> {
    const sales = await this.getSalesData(workspaceId, startDate, endDate);
    const expenses = await this.getExpensesData(workspaceId, startDate, endDate);

    // Group by month
    const monthlyData = new Map<string, { revenue: number; expenses: number }>();

    sales.forEach(sale => {
      const month = toIsoString(sale.SaleDate).substring(0, 7); // YYYY-MM
      if (!month) return;
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { revenue: 0, expenses: 0 });
      }
      monthlyData.get(month)!.revenue += Number(sale.TotalAmount) || 0;
    });

    expenses.forEach(expense => {
      const month = toIsoString(expense.CreatedAt).substring(0, 7);
      if (!month) return;
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { revenue: 0, expenses: 0 });
      }
      monthlyData.get(month)!.expenses += Number(expense.Amount) || 0;
    });

    const sortedMonths = Array.from(monthlyData.keys()).sort();

    return {
      labels: sortedMonths,
      datasets: [
        {
          label: 'Revenus',
          data: sortedMonths.map(month => monthlyData.get(month)!.revenue),
          backgroundColor: '#10b981',
          borderColor: '#10b981',
        },
        {
          label: 'Depenses',
          data: sortedMonths.map(month => monthlyData.get(month)!.expenses),
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
        },
      ],
    };
  }

  private async getSalesTrendChart(workspaceId: string, startDate: string, endDate: string): Promise<ChartData> {
    const sales = await this.getSalesData(workspaceId, startDate, endDate);

    // Group by day
    const dailyData = new Map<string, number>();

    sales.forEach(sale => {
      const day = toIsoString(sale.SaleDate).substring(0, 10);
      if (!day) return;
      dailyData.set(day, (dailyData.get(day) || 0) + (Number(sale.TotalAmount) || 0));
    });

    const sortedDays = Array.from(dailyData.keys()).sort();

    return {
      labels: sortedDays,
      datasets: [
        {
          label: 'Ventes journalieres',
          data: sortedDays.map(day => dailyData.get(day)!),
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
        },
      ],
    };
  }

  private async getCashflowTrendChart(workspaceId: string, startDate: string, endDate: string): Promise<ChartData> {
    const transactions = await this.getTransactionsData(workspaceId, startDate, endDate);

    // Group by month
    const monthlyData = new Map<string, { income: number; expense: number }>();

    transactions.forEach(tx => {
      const month = toIsoString(tx.ProcessedAt).substring(0, 7);
      if (!month) return;
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { income: 0, expense: 0 });
      }
      const amount = Number(tx.Amount) || 0;
      if (tx.Type === 'income') {
        monthlyData.get(month)!.income += amount;
      } else if (tx.Type === 'expense') {
        monthlyData.get(month)!.expense += amount;
      }
    });

    const sortedMonths = Array.from(monthlyData.keys()).sort();

    return {
      labels: sortedMonths,
      datasets: [
        {
          label: 'Encaissements',
          data: sortedMonths.map(month => monthlyData.get(month)!.income),
          backgroundColor: '#10b981',
          borderColor: '#10b981',
        },
        {
          label: 'Decaissements',
          data: sortedMonths.map(month => monthlyData.get(month)!.expense),
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
        },
      ],
    };
  }

  private async getTopProductsChart(workspaceId: string, startDate: string, endDate: string): Promise<ChartData> {
    // Agrégat SQL direct — l'ancien code lisait « sale_lines » (table
    // inexistante, la vraie est sale_items) en N+1 par vente.
    const result = await postgresClient.query(
      `SELECT COALESCE(p.name, si.product_name) AS label, SUM(si.total_price)::float AS total
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.sale_date < ($3::date + 1)
         AND s.status != 'cancelled'
       GROUP BY COALESCE(p.name, si.product_name)
       ORDER BY total DESC
       LIMIT 10`,
      [workspaceId, startDate, endDate]
    );
    const sorted = result.rows as Array<{ label: string; total: number }>;

    return {
      labels: sorted.map(p => p.label),
      datasets: [
        {
          label: 'Ventes par produit',
          data: sorted.map(p => p.total),
          backgroundColor: [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
          ],
        },
      ],
    };
  }

  private async getExpensesByCategoryChart(workspaceId: string, startDate: string, endDate: string): Promise<ChartData> {
    // Agrégat SQL direct (l'ancien code relisait expense_categories par
    // dépense, avec un filtre sans accolades = table entière à chaque tour)
    const result = await postgresClient.query(
      `SELECT COALESCE(c.label, 'Sans catégorie') AS label, SUM(e.amount)::float AS total
       FROM expenses e
       LEFT JOIN expense_categories c ON c.id = e.category_id
       WHERE e.workspace_id = $1 AND e.created_at >= $2 AND e.created_at < ($3::date + 1)
         AND e.status = 'paid'
       GROUP BY COALESCE(c.label, 'Sans catégorie')
       ORDER BY total DESC`,
      [workspaceId, startDate, endDate]
    );
    const sorted = result.rows as Array<{ label: string; total: number }>;

    return {
      labels: sorted.map(c => c.label),
      datasets: [
        {
          label: 'Depenses par categorie',
          data: sorted.map(c => c.total),
          backgroundColor: [
            '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
            '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
          ],
        },
      ],
    };
  }
}
