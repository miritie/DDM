/**
 * Service - Generation de Rapports
 * Module Rapports & Analytics
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import {
  Report,
  ReportExecution,
  SalesReport,
  ExpenseReport,
  CashflowReport,
  InventoryReport,
  HRReport,
  Sale,
  Expense,
  Transaction,
  Product,
  Employee
} from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export interface CreateReportInput {
  reportName: string;
  reportType: 'sales' | 'expenses' | 'inventory' | 'cashflow' | 'hr' | 'accounting' | 'custom';
  description?: string;
  parameters: Record<string, any>;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time?: string;
  };
  recipients?: string[];
  workspaceId: string;
}

export class ReportService {
  async create(input: CreateReportInput): Promise<Report> {
    const report: Partial<Report> = {
      ReportId: uuidv4(),
      ReportName: input.reportName,
      ReportType: input.reportType,
      Description: input.description,
      Parameters: input.parameters,
      Schedule: input.schedule,
      Recipients: input.recipients,
      IsActive: true,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Report>('reports', report);
    return created;
  }

  async execute(reportId: string, triggeredById: string): Promise<ReportExecution> {
    const reports = await postgresClient.list<Report>('reports', {
      where: { report_id: reportId },
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouve');
    }

    const report = reports[0];

    const executionId = uuidv4();
    const execution: Partial<ReportExecution> = {
      ExecutionId: executionId,
      ReportId: reportId,
      Status: 'pending',
      StartedAt: new Date().toISOString(),
      TriggeredById: triggeredById,
      CreatedAt: new Date().toISOString(),
    };

    const createdExecution = await postgresClient.create<ReportExecution>('report_executions', execution);

    // Generate report data asynchronously
    try {
      const reportData = await this.generateReportData(report);

      // Update execution with results
      if (createdExecution.id) {
        await postgresClient.update<ReportExecution>(
          'report_executions',
          createdExecution.id,
          {
            Status: 'completed',
            CompletedAt: new Date().toISOString(),
            ResultData: reportData,
          }
        );
      }
    } catch (error: any) {
      if (createdExecution.id) {
        await postgresClient.update<ReportExecution>(
          'report_executions',
          createdExecution.id,
          {
            Status: 'failed',
            CompletedAt: new Date().toISOString(),
            ErrorMessage: error.message,
          }
        );
      }
      throw error;
    }

    return createdExecution;
  }

  private async generateReportData(report: Report): Promise<any> {
    const { ReportType, Parameters, WorkspaceId } = report;

    switch (ReportType) {
      case 'sales':
        return await this.generateSalesReport(WorkspaceId, Parameters);
      case 'expenses':
        return await this.generateExpenseReport(WorkspaceId, Parameters);
      case 'cashflow':
        return await this.generateCashflowReport(WorkspaceId, Parameters);
      case 'inventory':
        return await this.generateInventoryReport(WorkspaceId, Parameters);
      case 'hr':
        return await this.generateHRReport(WorkspaceId, Parameters);
      default:
        throw new Error(`Type de rapport non supporte: ${ReportType}`);
    }
  }

  private async generateSalesReport(workspaceId: string, parameters: Record<string, any>): Promise<SalesReport> {
    const { startDate, endDate, groupBy = 'day' } = parameters;

    const sales = await postgresClient.listWhere<Sale>(
      'sales',
      `workspace_id = $1 AND sale_date >= $2 AND sale_date < ($3::date + 1) AND status != 'cancelled'`,
      [workspaceId, startDate, endDate]
    );

    const totalRevenue = sales.reduce((sum, s) => sum + s.TotalAmount, 0);
    const averageOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

    // Group by period
    const salesByPeriod = new Map<string, { revenue: number; count: number }>();
    sales.forEach(sale => {
      const iso = toIsoString(sale.SaleDate);
      let period: string;
      if (groupBy === 'day') {
        period = iso.substring(0, 10);
      } else if (groupBy === 'month') {
        period = iso.substring(0, 7);
      } else {
        period = iso.substring(0, 4);
      }

      if (!salesByPeriod.has(period)) {
        salesByPeriod.set(period, { revenue: 0, count: 0 });
      }
      salesByPeriod.get(period)!.revenue += sale.TotalAmount;
      salesByPeriod.get(period)!.count += 1;
    });

    // Top products — agrégat SQL (l'ancien code lisait « sale_lines »,
    // table inexistante : la vraie est sale_items)
    const topProductsR = await postgresClient.query(
      `SELECT COALESCE(p.product_id, si.product_id::text) AS "productId",
              COALESCE(p.name, si.product_name) AS "productName",
              SUM(si.quantity)::float AS quantity,
              SUM(si.total_price)::float AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.sale_date < ($3::date + 1)
         AND s.status != 'cancelled'
       GROUP BY 1, 2
       ORDER BY revenue DESC
       LIMIT 10`,
      [workspaceId, startDate, endDate]
    );
    const topProducts = topProductsR.rows;

    // Top customers — la table est « clients » (customers n'existe pas)
    const topCustomersR = await postgresClient.query(
      `SELECT c.client_id AS "customerId",
              COALESCE(c.company_name, c.name) AS "customerName",
              COUNT(*)::int AS "orderCount",
              SUM(s.total_amount)::float AS "totalRevenue"
       FROM sales s
       JOIN clients c ON c.id = s.client_id
       WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.sale_date < ($3::date + 1)
         AND s.status != 'cancelled'
       GROUP BY c.client_id, COALESCE(c.company_name, c.name)
       ORDER BY "totalRevenue" DESC
       LIMIT 10`,
      [workspaceId, startDate, endDate]
    );
    const topCustomers = topCustomersR.rows;

    return {
      period: { start: startDate, end: endDate },
      totalSales: sales.length,
      totalRevenue,
      totalProfit: 0, // TODO: Calculate profit from cost data
      averageOrderValue,
      topProducts,
      topClients: topCustomers.map(c => ({
        clientId: c.customerId,
        clientName: c.customerName,
        totalSpent: c.totalRevenue,
        orderCount: c.orderCount,
      })),
      salesByDay: { labels: [], datasets: [] }, // TODO: Implement
      salesByCategory: { labels: [], datasets: [] }, // TODO: Implement
    } as any;
  }

  private async generateExpenseReport(workspaceId: string, parameters: Record<string, any>): Promise<ExpenseReport> {
    const { startDate, endDate, groupBy = 'category' } = parameters;

    const expenses = await postgresClient.listWhere<Expense>(
      'expenses',
      `workspace_id = $1 AND created_at >= $2 AND created_at < ($3::date + 1)`,
      [workspaceId, startDate, endDate]
    );

    const totalAmount = expenses.reduce((sum, e) => sum + e.Amount, 0);

    // Group by category — agrégat SQL (l'ancien N+1 relisait la table
    // des catégories à chaque dépense, sans filtre effectif)
    const byCategoryR = await postgresClient.query(
      `SELECT COALESCE(c.label, 'Sans catégorie') AS "categoryName",
              SUM(e.amount)::float AS amount, COUNT(*)::int AS count
       FROM expenses e
       LEFT JOIN expense_categories c ON c.id = e.category_id
       WHERE e.workspace_id = $1 AND e.created_at >= $2 AND e.created_at < ($3::date + 1)
       GROUP BY COALESCE(c.label, 'Sans catégorie')
       ORDER BY amount DESC`,
      [workspaceId, startDate, endDate]
    );

    // Group by period
    const expensesByPeriod = new Map<string, { amount: number; count: number }>();
    expenses.forEach(expense => {
      const period = toIsoString(expense.CreatedAt).substring(0, 7); // Month
      if (!period) return;
      if (!expensesByPeriod.has(period)) {
        expensesByPeriod.set(period, { amount: 0, count: 0 });
      }
      expensesByPeriod.get(period)!.amount += Number(expense.Amount) || 0;
      expensesByPeriod.get(period)!.count += 1;
    });

    const categoryData = byCategoryR.rows as Array<{ categoryName: string; amount: number; count: number }>;

    return {
      period: { start: startDate, end: endDate },
      totalExpenses: totalAmount,
      paidExpenses: expenses.filter(e => e.Status === 'paid').reduce((sum, e) => sum + e.Amount, 0),
      pendingExpenses: expenses.filter(e => e.Status === 'pending').reduce((sum, e) => sum + e.Amount, 0),
      expensesByCategory: {
        labels: categoryData.map(c => c.categoryName),
        datasets: [{
          label: 'Depenses par categorie',
          data: categoryData.map(c => c.amount),
        }],
      },
      expensesByMonth: {
        labels: Array.from(expensesByPeriod.keys()).sort(),
        datasets: [{
          label: 'Depenses mensuelles',
          data: Array.from(expensesByPeriod.keys()).sort().map(k => expensesByPeriod.get(k)!.amount),
        }],
      },
      topExpenses: expenses
        .sort((a, b) => b.Amount - a.Amount)
        .slice(0, 10)
        .map(e => ({
          expenseId: e.ExpenseId,
          title: e.Title,
          amount: e.Amount,
          date: e.CreatedAt,
        })),
    };
  }

  private async generateCashflowReport(workspaceId: string, parameters: Record<string, any>): Promise<CashflowReport> {
    const { startDate, endDate } = parameters;

    const transactions = await postgresClient.listWhere<Transaction>(
      'transactions',
      `workspace_id = $1 AND processed_at >= $2 AND processed_at < ($3::date + 1)`,
      [workspaceId, startDate, endDate]
    );

    const totalInflow = transactions
      .filter(t => t.Type === 'income')
      .reduce((sum, t) => sum + t.Amount, 0);

    const totalOutflow = transactions
      .filter(t => t.Type === 'expense')
      .reduce((sum, t) => sum + t.Amount, 0);

    const netCashflow = totalInflow - totalOutflow;

    // Group by period
    const cashflowByPeriod = new Map<string, { inflow: number; outflow: number; net: number }>();
    transactions.forEach(tx => {
      const period = toIsoString(tx.ProcessedAt).substring(0, 7);
      if (!period) return;
      if (!cashflowByPeriod.has(period)) {
        cashflowByPeriod.set(period, { inflow: 0, outflow: 0, net: 0 });
      }
      const amount = Number(tx.Amount) || 0;
      if (tx.Type === 'income') {
        cashflowByPeriod.get(period)!.inflow += amount;
      } else if (tx.Type === 'expense') {
        cashflowByPeriod.get(period)!.outflow += amount;
      }
      cashflowByPeriod.get(period)!.net =
        cashflowByPeriod.get(period)!.inflow - cashflowByPeriod.get(period)!.outflow;
    });

    // Get opening and closing balance — agrégat SQL (la liste complète
    // des transactions historiques n'a pas à transiter par Node)
    const balR = await postgresClient.query(
      `SELECT COALESCE(SUM(CASE type WHEN 'income' THEN amount WHEN 'expense' THEN -amount ELSE 0 END), 0)::float AS bal
       FROM transactions
       WHERE workspace_id = $1 AND processed_at < ($2::date + 1)`,
      [workspaceId, endDate]
    );
    const closingBalance = balR.rows[0].bal as number;

    const openingBalance = closingBalance - netCashflow;

    const monthlyKeys = Array.from(cashflowByPeriod.keys()).sort();

    return {
      period: { start: startDate, end: endDate },
      openingBalance,
      closingBalance,
      totalInflows: totalInflow,
      totalOutflows: totalOutflow,
      netCashflow,
      inflowsByCategory: { labels: [], datasets: [] }, // TODO: Implement
      outflowsByCategory: { labels: [], datasets: [] }, // TODO: Implement
      cashflowByMonth: {
        labels: monthlyKeys,
        datasets: [{
          label: 'Encaissements',
          data: monthlyKeys.map(k => cashflowByPeriod.get(k)!.inflow),
        }, {
          label: 'Decaissements',
          data: monthlyKeys.map(k => cashflowByPeriod.get(k)!.outflow),
        }],
      },
    };
  }

  private async generateInventoryReport(workspaceId: string, parameters: Record<string, any>): Promise<InventoryReport> {
    const products = await postgresClient.list<Product>('products', {
      where: { workspace_id: workspaceId, is_active: true },
    });

    const totalProducts = products.length;

    // Note: Stock quantities are managed through StockItem, not directly on Product
    // For now, return basic product counts until stock module is fully implemented
    const totalStockValue = 0;
    const totalStockQuantity = 0;

    const lowStockProducts: any[] = [];
    const outOfStockProducts: any[] = [];

    // Products by category (without stock data for now)
    const stockByCategory = new Map<string, { categoryId: string; categoryName: string; quantity: number; value: number }>();

    for (const product of products) {
      if (product.Category) {
        const key = product.Category;
        if (!stockByCategory.has(key)) {
          stockByCategory.set(key, {
            categoryId: key,
            categoryName: key,
            quantity: 1,
            value: product.UnitPrice,
          });
        } else {
          stockByCategory.get(key)!.quantity += 1;
          stockByCategory.get(key)!.value += product.UnitPrice;
        }
      }
    }

    const { startDate, endDate } = parameters;

    return {
      period: { start: startDate ||new Date().toISOString().split('T')[0], end: endDate || new Date().toISOString().split('T')[0] },
      totalItems: totalProducts,
      totalValue: 0, // TODO: Calculate from StockItem
      lowStockItems: 0, // TODO: Calculate from StockItem
      outOfStockItems: 0, // TODO: Calculate from StockItem
      valueByWarehouse: { labels: [], datasets: [] }, // TODO: Implement
      topMovingItems: [], // TODO: Implement
    };
  }

  private async generateHRReport(workspaceId: string, parameters: Record<string, any>): Promise<HRReport> {
    const { startDate, endDate } = parameters;

    const employees = await postgresClient.list<Employee>('employees', {
      where: { workspace_id: workspaceId },
    });

    const activeEmployees = employees.filter(e => e.Status === 'active').length;
    const totalEmployees = employees.length;

    // Get leaves
    const leaves = await postgresClient.listWhere<any>(
      'leaves',
      `workspace_id = $1 AND start_date >= $2 AND end_date <= $3`,
      [workspaceId, startDate, endDate]
    );

    const totalLeaveDays = leaves.reduce((sum, l) => sum + (l.DaysCount || 0), 0);
    const approvedLeaves = leaves.filter(l => l.Status === 'approved').length;

    // Employees by department
    const employeesByDepartment = new Map<string, number>();
    employees.forEach(emp => {
      const dept = emp.Department || 'Non assigne';
      employeesByDepartment.set(dept, (employeesByDepartment.get(dept) || 0) + 1);
    });

    // Employees by position
    const employeesByPosition = new Map<string, number>();
    employees.forEach(emp => {
      const pos = emp.Position || 'Non assigne';
      employeesByPosition.set(pos, (employeesByPosition.get(pos) || 0) + 1);
    });

    const deptKeys = Array.from(employeesByDepartment.keys());

    return {
      period: { start: startDate, end: endDate },
      totalEmployees,
      activeEmployees,
      totalPayroll: 0, // TODO: Calculate from payroll data
      averageSalary: 0, // TODO: Calculate from employee salaries
      attendanceRate: 0, // TODO: Calculate from attendance data
      leavesTaken: totalLeaveDays,
      employeesByDepartment: {
        labels: deptKeys,
        datasets: [{
          label: 'Employes par departement',
          data: deptKeys.map(k => employeesByDepartment.get(k)!),
        }],
      },
      payrollByMonth: { labels: [], datasets: [] }, // TODO: Implement
    };
  }

  async getById(reportId: string): Promise<Report | null> {
    const reports = await postgresClient.list<Report>('reports', {
      where: { report_id: reportId },
    });
    return reports.length > 0 ? reports[0] : null;
  }

  async list(workspaceId: string, filters: { reportType?: string; isActive?: boolean } = {}): Promise<Report[]> {
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (filters.reportType) where.report_type = filters.reportType;
    if (filters.isActive !== undefined) where.is_active = filters.isActive;

    return await postgresClient.list<Report>('reports', {
      where,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  async getExecutions(reportId: string): Promise<ReportExecution[]> {
    return await postgresClient.list<ReportExecution>('report_executions', {
      where: { report_id: reportId },
      sort: [{ field: 'StartedAt', direction: 'desc' }],
    });
  }
}
