/**
 * Service - Gestion de la Paie
 * Module Ressources Humaines
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Payroll, Employee } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { AdvanceDebtService } from '@/lib/modules/advances-debts/advance-debt-service';

const airtableClient = new AirtableClient();
const advanceDebtService = new AdvanceDebtService();

export interface CreatePayrollInput {
  employeeId: string;
  period: string; // YYYY-MM format
  baseSalary: number;
  allowances?: number;
  bonuses?: number;
  deductions?: number;
  notes?: string;
  workspaceId: string;
}

export interface ProcessPayrollInput {
  payrollId: string;
  paymentDate: string;
  paymentMethod: string;
  processedById: string;
}

export class PayrollService {
  async generatePayrollNumber(workspaceId: string, period: string): Promise<string> {
    const payrolls = await airtableClient.list<Payroll>('Payroll', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Period} = '${period}')`,
    });
    return `PAY-${period}-${String(payrolls.length + 1).padStart(4, '0')}`;
  }

  async calculateAdvanceDeduction(employeeId: string, workspaceId: string): Promise<number> {
    try {
      // TODO: Implement advance deduction calculation
      // This requires linking AdvanceDebt.AccountId to Employee.EmployeeId
      // For now, return 0 - this can be manually entered in the payroll
      return 0;
    } catch (error) {
      console.error('Error calculating advance deduction:', error);
      return 0;
    }
  }

  async create(input: CreatePayrollInput): Promise<Payroll> {
    const payrollNumber = await this.generatePayrollNumber(input.workspaceId, input.period);
    const advanceDeduction = await this.calculateAdvanceDeduction(input.employeeId, input.workspaceId);

    const allowances = input.allowances || 0;
    const bonuses = input.bonuses || 0;
    const deductions = input.deductions || 0;

    const netSalary = input.baseSalary + allowances + bonuses - deductions - advanceDeduction;

    const payroll: Partial<Payroll> = {
      PayrollId: uuidv4(),
      PayrollNumber: payrollNumber,
      EmployeeId: input.employeeId,
      Period: input.period,
      BaseSalary: input.baseSalary,
      Allowances: allowances,
      Bonuses: bonuses,
      Deductions: deductions,
      AdvanceDeduction: advanceDeduction,
      NetSalary: netSalary,
      Status: 'draft',
      Notes: input.notes,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<Payroll>('Payroll', payroll);
  }

  async getById(payrollId: string): Promise<Payroll | null> {
    const payrolls = await airtableClient.list<Payroll>('Payroll', {
      filterByFormula: `{PayrollId} = '${payrollId}'`,
    });
    return payrolls.length > 0 ? payrolls[0] : null;
  }

  async list(
    workspaceId: string,
    filters: { employeeId?: string; period?: string; status?: string } = {}
  ): Promise<Payroll[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.employeeId) {
      filterFormulas.push(`{EmployeeId} = '${filters.employeeId}'`);
    }
    if (filters.period) {
      filterFormulas.push(`{Period} = '${filters.period}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await airtableClient.list<Payroll>('Payroll', {
      filterByFormula,
      sort: [{ field: 'Period', direction: 'desc' }],
    });
  }

  async validate(payrollId: string): Promise<Payroll> {
    const payrolls = await airtableClient.list<Payroll>('Payroll', {
      filterByFormula: `{PayrollId} = '${payrollId}'`,
    });

    if (payrolls.length === 0) {
      throw new Error('Paie non trouvée');
    }

    if (payrolls[0].Status !== 'draft') {
      throw new Error('Seules les paies en brouillon peuvent être validées');
    }

    return await airtableClient.update<Payroll>(
      'Payroll',
      (payrolls[0] as any)._recordId,
      {
        Status: 'validated',
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async process(input: ProcessPayrollInput): Promise<Payroll> {
    const payrolls = await airtableClient.list<Payroll>('Payroll', {
      filterByFormula: `{PayrollId} = '${input.payrollId}'`,
    });

    if (payrolls.length === 0) {
      throw new Error('Paie non trouvée');
    }

    if (payrolls[0].Status !== 'validated') {
      throw new Error('La paie doit être validée avant d\'être payée');
    }

    return await airtableClient.update<Payroll>(
      'Payroll',
      (payrolls[0] as any)._recordId,
      {
        Status: 'paid',
        PaymentDate: input.paymentDate,
        PaymentMethod: input.paymentMethod,
        ProcessedById: input.processedById,
        ProcessedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async cancel(payrollId: string): Promise<Payroll> {
    const payrolls = await airtableClient.list<Payroll>('Payroll', {
      filterByFormula: `{PayrollId} = '${payrollId}'`,
    });

    if (payrolls.length === 0) {
      throw new Error('Paie non trouvée');
    }

    if (payrolls[0].Status === 'paid') {
      throw new Error('Une paie payée ne peut pas être annulée');
    }

    return await airtableClient.update<Payroll>(
      'Payroll',
      (payrolls[0] as any)._recordId,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
  }

  async generateBulkPayroll(
    workspaceId: string,
    period: string,
    employeeIds?: string[]
  ): Promise<Payroll[]> {
    // Get all active employees or specified employees
    const filterFormulas: string[] = [
      `{WorkspaceId} = '${workspaceId}'`,
      `{Status} = 'active'`,
    ];

    if (employeeIds && employeeIds.length > 0) {
      const employeeFilter = employeeIds.map((id) => `{EmployeeId} = '${id}'`).join(', ');
      filterFormulas.push(`OR(${employeeFilter})`);
    }

    const employees = await airtableClient.list<Employee>('Employee', {
      filterByFormula: `AND(${filterFormulas.join(', ')})`,
    });

    // Check for existing payrolls
    const existingPayrolls = await this.list(workspaceId, { period });
    const existingEmployeeIds = new Set(existingPayrolls.map((p) => p.EmployeeId));

    // Create payrolls for employees without existing payroll for this period
    const payrolls: Payroll[] = [];
    for (const employee of employees) {
      if (!existingEmployeeIds.has(employee.EmployeeId)) {
        const payroll = await this.create({
          employeeId: employee.EmployeeId,
          period,
          baseSalary: employee.BaseSalary,
          allowances: 0,
          bonuses: 0,
          deductions: 0,
          workspaceId,
        });
        payrolls.push(payroll);
      }
    }

    return payrolls;
  }

  async getStatistics(workspaceId: string, period?: string): Promise<any> {
    const filters: any = {};
    if (period) {
      filters.period = period;
    }

    const payrolls = await this.list(workspaceId, filters);

    const totalGrossSalary = payrolls.reduce((sum, p) => sum + p.BaseSalary, 0);
    const totalAllowances = payrolls.reduce((sum, p) => sum + (p.Allowances || 0), 0);
    const totalBonuses = payrolls.reduce((sum, p) => sum + (p.Bonuses || 0), 0);
    const totalDeductions = payrolls.reduce((sum, p) => sum + (p.Deductions || 0), 0);
    const totalAdvanceDeductions = payrolls.reduce((sum, p) => sum + (p.AdvanceDeduction || 0), 0);
    const totalNetSalary = payrolls.reduce((sum, p) => sum + p.NetSalary, 0);

    const statusDistribution = payrolls.reduce((acc: any, payroll) => {
      acc[payroll.Status] = (acc[payroll.Status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPayrolls: payrolls.length,
      totalGrossSalary,
      totalAllowances,
      totalBonuses,
      totalDeductions,
      totalAdvanceDeductions,
      totalNetSalary,
      averageNetSalary: payrolls.length > 0 ? totalNetSalary / payrolls.length : 0,
      statusDistribution,
      period: period || 'all',
    };
  }
}
