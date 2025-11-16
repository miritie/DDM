/**
 * Service - Dashboard Global avec KPIs
 * Module Rapports & Analytics
 */

import { AirtableClient } from '@/lib/airtable/client';
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

const airtableClient = new AirtableClient();

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
      expenses: this.createKPI('Dépenses', totalExpenses, previousTotalExpenses, 'currency'),
      profit: this.createKPI('Bénéfice net', profit, previousProfit, 'currency'),
      cashBalance: this.createKPI('Trésorerie', cashBalance, undefined, 'currency'),
      sales: this.createKPI('Ventes', sales.length, previousSales.length, 'number'),
      customers: this.createKPI('Clients actifs', new Set(sales.map(s => s.ClientId)).size, undefined, 'number'),
      inventory: this.createKPI('Produits actifs', products.length, undefined, 'number'),
      employees: this.createKPI('Employés', employees.length, undefined, 'number'),
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

  private async getSalesData(workspaceId: string, startDate: string, endDate: string): Promise<Sale[]> {
    return await airtableClient.list<Sale>('Sale', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {SaleDate} >= '${startDate}', {SaleDate} <= '${endDate}', {Status} != 'cancelled')`,
    });
  }

  private async getExpensesData(workspaceId: string, startDate: string, endDate: string): Promise<Expense[]> {
    return await airtableClient.list<Expense>('Expense', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {CreatedAt} >= '${startDate}', {CreatedAt} <= '${endDate}', {Status} = 'paid')`,
    });
  }

  private async getTransactionsData(workspaceId: string, startDate: string, endDate: string): Promise<Transaction[]> {
    return await airtableClient.list<Transaction>('Transaction', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {ProcessedAt} >= '${startDate}', {ProcessedAt} <= '${endDate}')`,
    });
  }

  private async getProductsData(workspaceId: string): Promise<Product[]> {
    return await airtableClient.list<Product>('Product', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {IsActive} = 1)`,
    });
  }

  private async getEmployeesData(workspaceId: string): Promise<Employee[]> {
    return await airtableClient.list<Employee>('Employee', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Status} = 'active')`,
    });
  }

  private async getRevenueVsExpensesChart(workspaceId: string, startDate: string, endDate: string): Promise<ChartData> {
    const sales = await this.getSalesData(workspaceId, startDate, endDate);
    const expenses = await this.getExpensesData(workspaceId, startDate, endDate);

    // Group by month
    const monthlyData = new Map<string, { revenue: number; expenses: number }>();

    sales.forEach(sale => {
      const month = sale.SaleDate.substring(0, 7); // YYYY-MM
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { revenue: 0, expenses: 0 });
      }
      monthlyData.get(month)!.revenue += sale.TotalAmount;
    });

    expenses.forEach(expense => {
      const month = expense.CreatedAt.substring(0, 7);
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { revenue: 0, expenses: 0 });
      }
      monthlyData.get(month)!.expenses += expense.Amount;
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
          label: 'Dépenses',
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
      const day = sale.SaleDate;
      dailyData.set(day, (dailyData.get(day) || 0) + sale.TotalAmount);
    });

    const sortedDays = Array.from(dailyData.keys()).sort();

    return {
      labels: sortedDays,
      datasets: [
        {
          label: 'Ventes journalières',
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
      const month = tx.ProcessedAt.substring(0, 7);
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { income: 0, expense: 0 });
      }
      if (tx.Type === 'income') {
        monthlyData.get(month)!.income += tx.Amount;
      } else if (tx.Type === 'expense') {
        monthlyData.get(month)!.expense += tx.Amount;
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
          label: 'Décaissements',
          data: sortedMonths.map(month => monthlyData.get(month)!.expense),
          backgroundColor: '#ef4444',
          borderColor: '#ef4444',
        },
      ],
    };
  }

  private async getTopProductsChart(workspaceId: string, startDate: string, endDate: string): Promise<ChartData> {
    const sales = await this.getSalesData(workspaceId, startDate, endDate);

    // Aggregate by product
    const productSales = new Map<string, { label: string; total: number }>();

    for (const sale of sales) {
      // Get sale lines
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
          if (!productSales.has(key)) {
            productSales.set(key, { label: product.Name, total: 0 });
          }
          productSales.get(key)!.total += line.TotalPrice;
        }
      }
    }

    // Get top 10
    const sorted = Array.from(productSales.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

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
    const expenses = await this.getExpensesData(workspaceId, startDate, endDate);

    // Aggregate by category
    const categoryExpenses = new Map<string, { label: string; total: number }>();

    for (const expense of expenses) {
      const categories = await airtableClient.list<any>('ExpenseCategory', {
        filterByFormula: `{ExpenseCategoryId} = '${expense.CategoryId}'`,
      });

      if (categories.length > 0) {
        const category = categories[0];
        const key = category.ExpenseCategoryId;
        if (!categoryExpenses.has(key)) {
          categoryExpenses.set(key, { label: category.Label, total: 0 });
        }
        categoryExpenses.get(key)!.total += expense.Amount;
      }
    }

    const sorted = Array.from(categoryExpenses.values())
      .sort((a, b) => b.total - a.total);

    return {
      labels: sorted.map(c => c.label),
      datasets: [
        {
          label: 'Dépenses par catégorie',
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
