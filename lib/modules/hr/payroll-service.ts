/**
 * Service - Gestion de la Paie
 * Module Ressources Humaines
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Payroll, Employee } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { AdvanceDebtService } from '@/lib/modules/advances-debts/advance-debt-service';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';

const postgresClient = getPostgresClient();
const advanceDebtService = new AdvanceDebtService();
const paymentMethodService = new PaymentMethodService();

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
    const payrolls = await postgresClient.list<Payroll>('payrolls', {
      filterByFormula: `AND(workspace_id = '${workspaceId}', period = '${period}')`,
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

    const payroll: any = {
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

    const created = await postgresClient.create<Payroll>('payrolls', payroll);
    return created;
  }

  async getById(payrollId: string): Promise<Payroll | null> {
    const payrolls = await postgresClient.list<Payroll>('payrolls', {
      filterByFormula: `payroll_id = '${payrollId}'`,
    });
    return payrolls.length > 0 ? payrolls[0] : null;
  }

  async list(
    workspaceId: string,
    filters: { employeeId?: string; period?: string; status?: string } = {}
  ): Promise<Payroll[]> {
    const filterFormulas: string[] = [`workspace_id = '${workspaceId}'`];

    if (filters.employeeId) {
      filterFormulas.push(`employee_id = '${filters.employeeId}'`);
    }
    if (filters.period) {
      filterFormulas.push(`period = '${filters.period}'`);
    }
    if (filters.status) {
      filterFormulas.push(`status = '${filters.status}'`);
    }

    const filterByFormula =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(', ')})`
        : filterFormulas[0];

    return await postgresClient.list<Payroll>('payrolls', {
      filterByFormula,
      sort: [{ field: 'Period', direction: 'desc' }],
    });
  }

  async validate(payrollId: string): Promise<Payroll> {
    const payrolls = await postgresClient.list<Payroll>('payrolls', {
      filterByFormula: `payroll_id = '${payrollId}'`,
    });

    if (payrolls.length === 0) {
      throw new Error('Paie non trouvée');
    }

    if (payrolls[0].Status !== 'draft') {
      throw new Error('Seules les paies en brouillon peuvent être validées');
    }

    if (!payrolls[0].id) {
      throw new Error('Payroll ID is missing');
    }

    const updated = await postgresClient.update<Payroll>(
      'payrolls',
      payrolls[0].id,
      {
        Status: 'validated',
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async process(input: ProcessPayrollInput): Promise<Payroll> {
    const payrolls = await postgresClient.list<Payroll>('payrolls', {
      filterByFormula: `payroll_id = '${input.payrollId}'`,
    });

    if (payrolls.length === 0) {
      throw new Error('Paie non trouvée');
    }

    if (payrolls[0].Status !== 'validated') {
      throw new Error('La paie doit être validée avant d\'être payée');
    }

    if (!payrolls[0].id) {
      throw new Error('Payroll ID is missing');
    }

    // Résolution payment_method_id (la colonne legacy a été supprimée en 2c).
    const wsId = (payrolls[0] as any).WorkspaceId || (payrolls[0] as any).workspace_id;
    if (!wsId) throw new Error('Workspace introuvable pour cette paie');
    const pm = await paymentMethodService.getByCode(wsId, input.paymentMethod);
    if (!pm?.Id) {
      throw new Error(`Moyen de paiement "${input.paymentMethod}" introuvable ou inactif dans ce workspace.`);
    }

    const updateData: any = {
      Status: 'paid',
      PaidAt: input.paymentDate,
      PaymentMethodId: pm.Id,
      PaidById: input.processedById,
      UpdatedAt: new Date().toISOString(),
    };
    const updated = await postgresClient.update<Payroll>('payrolls', payrolls[0].id, updateData);
    return updated;
  }

  async cancel(payrollId: string): Promise<Payroll> {
    const payrolls = await postgresClient.list<Payroll>('payrolls', {
      filterByFormula: `payroll_id = '${payrollId}'`,
    });

    if (payrolls.length === 0) {
      throw new Error('Paie non trouvée');
    }

    if (payrolls[0].Status === 'paid') {
      throw new Error('Une paie payée ne peut pas être annulée');
    }

    if (!payrolls[0].id) {
      throw new Error('Payroll ID is missing');
    }

    const updated = await postgresClient.update<Payroll>(
      'payrolls',
      payrolls[0].id,
      {
        Status: 'cancelled',
        UpdatedAt: new Date().toISOString(),
      }
    );
    return updated;
  }

  async generateBulkPayroll(
    workspaceId: string,
    period: string,
    employeeIds?: string[]
  ): Promise<Payroll[]> {
    // Get all active employees or specified employees
    const filterFormulas: string[] = [
      `workspace_id = '${workspaceId}'`,
      `status = 'active'`,
    ];

    if (employeeIds && employeeIds.length > 0) {
      const employeeFilter = employeeIds.map((id) => `employee_id = '${id}'`).join(', ');
      filterFormulas.push(`OR(${employeeFilter})`);
    }

    const employees = await postgresClient.list<Employee>('employees', {
      filterByFormula: `AND(${filterFormulas.join(', ')})`,
    });

    // Check for existing payrolls
    const existingPayrolls = await this.list(workspaceId, { period });
    const existingEmployeeIds = new Set(existingPayrolls.map((p) => (p as any).EmployeeId));

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

    const totalGrossSalary = payrolls.reduce((sum: number, p: any) => sum + (p.BaseSalary || p.TotalGross || 0), 0);
    const totalAllowances = payrolls.reduce((sum: number, p: any) => sum + (p.Allowances || 0), 0);
    const totalBonuses = payrolls.reduce((sum: number, p: any) => sum + (p.Bonuses || p.TotalBonuses || 0), 0);
    const totalDeductions = payrolls.reduce((sum: number, p: any) => sum + (p.Deductions || p.TotalDeductions || 0), 0);
    const totalAdvanceDeductions = payrolls.reduce((sum: number, p: any) => sum + (p.AdvanceDeduction || p.TotalAdvances || 0), 0);
    const totalNetSalary = payrolls.reduce((sum: number, p: any) => sum + (p.NetSalary || p.TotalNet || 0), 0);

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
