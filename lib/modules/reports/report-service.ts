/**
 * Service - Génération de Rapports
 * Module Rapports & Analytics
 */

import { AirtableClient } from '@/lib/airtable/client';
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

const airtableClient = new AirtableClient();

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

    return await airtableClient.create<Report>('Report', report);
  }

  async execute(reportId: string, triggeredById: string): Promise<ReportExecution> {
    const reports = await airtableClient.list<Report>('Report', {
      filterByFormula: `{ReportId} = '${reportId}'`,
    });

    if (reports.length === 0) {
      throw new Error('Rapport non trouvé');
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

    const createdExecution = await airtableClient.create<ReportExecution>('ReportExecution', execution);

    // Generate report data asynchronously
    try {
      const reportData = await this.generateReportData(report);

      // Update execution with results
      await airtableClient.update<ReportExecution>(
        'ReportExecution',
        (createdExecution as any)._recordId,
        {
          Status: 'completed',
          CompletedAt: new Date().toISOString(),
          ResultData: reportData,
        }
      );
    } catch (error: any) {
      await airtableClient.update<ReportExecution>(
        'ReportExecution',
        (createdExecution as any)._recordId,
        {
          Status: 'failed',
          CompletedAt: new Date().toISOString(),
          ErrorMessage: error.message,
        }
      );
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
        throw new Error(`Type de rapport non supporté: ${ReportType}`);
    }
  }

  private async generateSalesReport(workspaceId: string, parameters: Record<string, any>): Promise<SalesReport> {
    const { startDate, endDate, groupBy = 'day' } = parameters;

    const sales = await airtableClient.list<Sale>('Sale', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {SaleDate} >= '${startDate}', {SaleDate} <= '${endDate}', {Status} != 'cancelled')`,
    });

    const totalRevenue = sales.reduce((sum, s) => sum + s.TotalAmount, 0);
    const totalQuantity = 0; // TODO: Calculate from sale lines
    const averageOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

    // Group by period
    const salesByPeriod = new Map<string, { revenue: number; count: number }>();
    sales.forEach(sale => {
      let period: string;
      if (groupBy === 'day') {
        period = sale.SaleDate;
      } else if (groupBy === 'month') {
        period = sale.SaleDate.substring(0, 7);
      } else {
        period = sale.SaleDate.substring(0, 4);
      }

      if (!salesByPeriod.has(period)) {
        salesByPeriod.set(period, { revenue: 0, count: 0 });
      }
      salesByPeriod.get(period)!.revenue += sale.TotalAmount;
      salesByPeriod.get(period)!.count += 1;
    });

    // Top products
    const productSales = new Map<string, { productId: string; productName: string; quantity: number; revenue: number }>();

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
          if (!productSales.has(key)) {
            productSales.set(key, {
              productId: product.ProductId,
              productName: product.Name,
              quantity: 0,
              revenue: 0,
            });
          }
          productSales.get(key)!.quantity += line.Quantity;
          productSales.get(key)!.revenue += line.TotalPrice;
        }
      }
    }

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top customers
    const customerSales = new Map<string, { customerId: string; customerName: string; orderCount: number; totalRevenue: number }>();

    for (const sale of sales) {
      const customers = await airtableClient.list<any>('Customer', {
        filterByFormula: `{CustomerId} = '${sale.ClientId}'`,
      });

      if (customers.length > 0) {
        const customer = customers[0];
        const key = customer.CustomerId;
        if (!customerSales.has(key)) {
          customerSales.set(key, {
            customerId: customer.CustomerId,
            customerName: customer.CompanyName || customer.FullName,
            orderCount: 0,
            totalRevenue: 0,
          });
        }
        customerSales.get(key)!.orderCount += 1;
        customerSales.get(key)!.totalRevenue += sale.TotalAmount;
      }
    }

    const topCustomers = Array.from(customerSales.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

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

    const expenses = await airtableClient.list<Expense>('Expense', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {CreatedAt} >= '${startDate}', {CreatedAt} <= '${endDate}')`,
    });

    const totalAmount = expenses.reduce((sum, e) => sum + e.Amount, 0);

    // Group by category
    const expensesByCategory = new Map<string, { categoryId: string; categoryName: string; amount: number; count: number }>();

    for (const expense of expenses) {
      const categories = await airtableClient.list<any>('ExpenseCategory', {
        filterByFormula: `{ExpenseCategoryId} = '${expense.CategoryId}'`,
      });

      if (categories.length > 0) {
        const category = categories[0];
        const key = category.ExpenseCategoryId;
        if (!expensesByCategory.has(key)) {
          expensesByCategory.set(key, {
            categoryId: category.ExpenseCategoryId,
            categoryName: category.Label,
            amount: 0,
            count: 0,
          });
        }
        expensesByCategory.get(key)!.amount += expense.Amount;
        expensesByCategory.get(key)!.count += 1;
      }
    }

    // Group by period
    const expensesByPeriod = new Map<string, { amount: number; count: number }>();
    expenses.forEach(expense => {
      const period = expense.CreatedAt.substring(0, 7); // Month
      if (!expensesByPeriod.has(period)) {
        expensesByPeriod.set(period, { amount: 0, count: 0 });
      }
      expensesByPeriod.get(period)!.amount += expense.Amount;
      expensesByPeriod.get(period)!.count += 1;
    });

    const categoryData = Array.from(expensesByCategory.values());

    return {
      period: { start: startDate, end: endDate },
      totalExpenses: totalAmount,
      paidExpenses: expenses.filter(e => e.Status === 'paid').reduce((sum, e) => sum + e.Amount, 0),
      pendingExpenses: expenses.filter(e => e.Status === 'pending').reduce((sum, e) => sum + e.Amount, 0),
      expensesByCategory: {
        labels: categoryData.map(c => c.categoryName),
        datasets: [{
          label: 'Dépenses par catégorie',
          data: categoryData.map(c => c.amount),
        }],
      },
      expensesByMonth: {
        labels: Array.from(expensesByPeriod.keys()).sort(),
        datasets: [{
          label: 'Dépenses mensuelles',
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

    const transactions = await airtableClient.list<Transaction>('Transaction', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {ProcessedAt} >= '${startDate}', {ProcessedAt} <= '${endDate}')`,
    });

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
      const period = tx.ProcessedAt.substring(0, 7);
      if (!cashflowByPeriod.has(period)) {
        cashflowByPeriod.set(period, { inflow: 0, outflow: 0, net: 0 });
      }
      if (tx.Type === 'income') {
        cashflowByPeriod.get(period)!.inflow += tx.Amount;
      } else if (tx.Type === 'expense') {
        cashflowByPeriod.get(period)!.outflow += tx.Amount;
      }
      cashflowByPeriod.get(period)!.net =
        cashflowByPeriod.get(period)!.inflow - cashflowByPeriod.get(period)!.outflow;
    });

    // Get opening and closing balance
    const allTransactions = await airtableClient.list<Transaction>('Transaction', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {ProcessedAt} < '${endDate}')`,
    });

    const closingBalance = allTransactions.reduce((sum, t) =>
      sum + (t.Type === 'income' ? t.Amount : t.Type === 'expense' ? -t.Amount : 0), 0
    );

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
          label: 'Décaissements',
          data: monthlyKeys.map(k => cashflowByPeriod.get(k)!.outflow),
        }],
      },
    };
  }

  private async generateInventoryReport(workspaceId: string, parameters: Record<string, any>): Promise<InventoryReport> {
    const products = await airtableClient.list<Product>('Product', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {IsActive} = 1)`,
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

    const employees = await airtableClient.list<Employee>('Employee', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });

    const activeEmployees = employees.filter(e => e.Status === 'active').length;
    const totalEmployees = employees.length;

    // Get leaves
    const leaves = await airtableClient.list<any>('Leave', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {StartDate} >= '${startDate}', {EndDate} <= '${endDate}')`,
    });

    const totalLeaveDays = leaves.reduce((sum, l) => sum + (l.DaysCount || 0), 0);
    const approvedLeaves = leaves.filter(l => l.Status === 'approved').length;

    // Employees by department
    const employeesByDepartment = new Map<string, number>();
    employees.forEach(emp => {
      const dept = emp.Department || 'Non assigné';
      employeesByDepartment.set(dept, (employeesByDepartment.get(dept) || 0) + 1);
    });

    // Employees by position
    const employeesByPosition = new Map<string, number>();
    employees.forEach(emp => {
      const pos = emp.Position || 'Non assigné';
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
          label: 'Employés par département',
          data: deptKeys.map(k => employeesByDepartment.get(k)!),
        }],
      },
      payrollByMonth: { labels: [], datasets: [] }, // TODO: Implement
    };
  }

  async getById(reportId: string): Promise<Report | null> {
    const reports = await airtableClient.list<Report>('Report', {
      filterByFormula: `{ReportId} = '${reportId}'`,
    });
    return reports.length > 0 ? reports[0] : null;
  }

  async list(workspaceId: string, filters: { reportType?: string; isActive?: boolean } = {}): Promise<Report[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.reportType) {
      filterFormulas.push(`{ReportType} = '${filters.reportType}'`);
    }
    if (filters.isActive !== undefined) {
      filterFormulas.push(`{IsActive} = ${filters.isActive ? '1' : '0'}`);
    }

    const filterByFormula = filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<Report>('Report', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  async getExecutions(reportId: string): Promise<ReportExecution[]> {
    return await airtableClient.list<ReportExecution>('ReportExecution', {
      filterByFormula: `{ReportId} = '${reportId}'`,
      sort: [{ field: 'StartedAt', direction: 'desc' }],
    });
  }
}
