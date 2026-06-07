/**
 * Service - Gestion de la Paie
 * Module Ressources Humaines
 *
 * Réécrit en SQL direct : l'ancienne version utilisait la syntaxe
 * Airtable `AND(...)` (ignorée par le parseur → lectures de tables
 * entières), insérait l'ID métier de l'employé dans la colonne UUID
 * (employee_id REFERENCES employees(id)) et mettait à jour des colonnes
 * disparues (paid_at, payment_method supprimée par la migration 2c).
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';

const postgresClient = getPostgresClient();
const paymentMethodService = new PaymentMethodService();

export interface CreatePayrollInput {
  employeeId: string; // UUID employees.id OU code métier employees.employee_id
  period: string; // YYYY-MM
  baseSalary?: number;
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

/** Colonnes renvoyées aux pages (PascalCase) + nom de l'employé joint. */
const SELECT_PAYROLL = `
  SELECT p.id AS "Id", p.payroll_id AS "PayrollId", p.payroll_number AS "PayrollNumber",
         p.period AS "Period", p.employee_id AS "EmployeeUuid",
         e.employee_id AS "EmployeeId", e.full_name AS "EmployeeName",
         p.base_salary::float AS "BaseSalary", p.allowances::float AS "Allowances",
         p.bonuses::float AS "Bonuses", p.deductions::float AS "Deductions",
         p.advance_deduction::float AS "AdvanceDeduction", p.net_salary::float AS "NetSalary",
         p.status AS "Status", p.notes AS "Notes",
         p.payment_date AS "PaymentDate", p.processed_at AS "ProcessedAt",
         p.workspace_id AS "WorkspaceId", p.created_at AS "CreatedAt"
  FROM payrolls p
  LEFT JOIN employees e ON e.id = p.employee_id`;

export class PayrollService {
  private async findEmployee(workspaceId: string, employeeRef: string) {
    const r = await postgresClient.query(
      `SELECT id, employee_id, full_name, base_salary::float AS base_salary
       FROM employees
       WHERE workspace_id = $1 AND (id::text = $2 OR employee_id = $2)
       LIMIT 1`,
      [workspaceId, employeeRef]
    );
    return r.rows[0] ?? null;
  }

  private async nextNumber(workspaceId: string, period: string): Promise<string> {
    const r = await postgresClient.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(payroll_number, '.*-', ''), '')::int), 0) + 1 AS next
       FROM payrolls WHERE workspace_id = $1 AND period = $2`,
      [workspaceId, period]
    );
    return `PAY-${period}-${String(r.rows[0].next).padStart(4, '0')}`;
  }

  async getById(payrollId: string): Promise<any | null> {
    const r = await postgresClient.query(
      `${SELECT_PAYROLL} WHERE p.payroll_id = $1 OR p.id::text = $1 LIMIT 1`,
      [payrollId]
    );
    return r.rows[0] ?? null;
  }

  async list(
    workspaceId: string,
    filters: { employeeId?: string; period?: string; status?: string } = {}
  ): Promise<any[]> {
    const params: any[] = [workspaceId];
    let where = `p.workspace_id = $1`;
    if (filters.employeeId) {
      params.push(filters.employeeId);
      where += ` AND (p.employee_id::text = $${params.length} OR e.employee_id = $${params.length})`;
    }
    if (filters.period) {
      params.push(filters.period);
      where += ` AND p.period = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      where += ` AND p.status = $${params.length}`;
    }
    const r = await postgresClient.query(
      `${SELECT_PAYROLL} WHERE ${where} ORDER BY p.period DESC, p.created_at DESC LIMIT 1000`,
      params
    );
    return r.rows;
  }

  async create(input: CreatePayrollInput): Promise<any> {
    if (!/^\d{4}-\d{2}$/.test(input.period)) {
      throw new Error('Période invalide (format attendu : AAAA-MM)');
    }
    const employee = await this.findEmployee(input.workspaceId, input.employeeId);
    if (!employee) throw new Error('Employé introuvable');

    const dup = await postgresClient.query(
      `SELECT 1 FROM payrolls
       WHERE workspace_id = $1 AND employee_id = $2 AND period = $3 AND status != 'cancelled'
       LIMIT 1`,
      [input.workspaceId, employee.id, input.period]
    );
    if (dup.rows[0]) {
      throw new Error(`Une paie existe déjà pour ${employee.full_name} sur ${input.period}`);
    }

    const baseSalary = input.baseSalary ?? employee.base_salary ?? 0;
    const allowances = input.allowances || 0;
    const bonuses = input.bonuses || 0;
    const deductions = input.deductions || 0;
    const netSalary = baseSalary + allowances + bonuses - deductions;

    const payrollId = uuidv4();
    const number = await this.nextNumber(input.workspaceId, input.period);
    await postgresClient.query(
      `INSERT INTO payrolls (payroll_id, payroll_number, employee_id, period, base_salary,
                             allowances, bonuses, deductions, advance_deduction, net_salary,
                             status, notes, workspace_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, 'draft', $10, $11)`,
      [payrollId, number, employee.id, input.period, baseSalary,
       allowances, bonuses, deductions, netSalary, input.notes ?? null, input.workspaceId]
    );
    return this.getById(payrollId);
  }

  async validate(payrollId: string): Promise<any> {
    const payroll = await this.getById(payrollId);
    if (!payroll) throw new Error('Paie non trouvée');
    if (payroll.Status !== 'draft') {
      throw new Error('Seules les paies en brouillon peuvent être validées');
    }
    await postgresClient.query(
      `UPDATE payrolls SET status = 'validated', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [payroll.Id]
    );
    return this.getById(payrollId);
  }

  async process(input: ProcessPayrollInput): Promise<any> {
    const payroll = await this.getById(input.payrollId);
    if (!payroll) throw new Error('Paie non trouvée');
    if (payroll.Status !== 'validated') {
      throw new Error("La paie doit être validée avant d'être payée");
    }

    // Résolution payment_method_id (la colonne enum legacy a été supprimée en 2c).
    const pm = await paymentMethodService.getByCode(payroll.WorkspaceId, input.paymentMethod);
    if (!pm?.Id) {
      throw new Error(`Moyen de paiement "${input.paymentMethod}" introuvable ou inactif dans ce workspace.`);
    }

    await postgresClient.query(
      `UPDATE payrolls
       SET status = 'paid', payment_date = $2, payment_method_id = $3,
           processed_by_id = $4, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [payroll.Id, input.paymentDate, pm.Id, input.processedById]
    );
    return this.getById(input.payrollId);
  }

  async cancel(payrollId: string): Promise<any> {
    const payroll = await this.getById(payrollId);
    if (!payroll) throw new Error('Paie non trouvée');
    if (payroll.Status === 'paid') {
      throw new Error('Une paie payée ne peut pas être annulée');
    }
    await postgresClient.query(
      `UPDATE payrolls SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [payroll.Id]
    );
    return this.getById(payrollId);
  }

  /**
   * Génère les paies du mois pour tous les employés actifs (ou la
   * sélection passée), en sautant ceux qui ont déjà une paie sur la
   * période (hors annulées).
   */
  async generateBulkPayroll(
    workspaceId: string,
    period: string,
    employeeIds?: string[]
  ): Promise<any[]> {
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new Error('Période invalide (format attendu : AAAA-MM)');
    }
    const params: any[] = [workspaceId];
    let where = `workspace_id = $1 AND status = 'active'`;
    if (employeeIds && employeeIds.length > 0) {
      params.push(employeeIds);
      where += ` AND (id::text = ANY($${params.length}) OR employee_id = ANY($${params.length}))`;
    }
    const employees = (await postgresClient.query(
      `SELECT id, full_name, base_salary::float AS base_salary FROM employees WHERE ${where}`,
      params
    )).rows;

    const existing = new Set(
      (await postgresClient.query(
        `SELECT employee_id FROM payrolls
         WHERE workspace_id = $1 AND period = $2 AND status != 'cancelled'`,
        [workspaceId, period]
      )).rows.map((r: any) => r.employee_id)
    );

    const payrolls: any[] = [];
    for (const employee of employees) {
      if (existing.has(employee.id)) continue;
      payrolls.push(await this.create({
        employeeId: employee.id,
        period,
        baseSalary: employee.base_salary,
        workspaceId,
      }));
    }
    return payrolls;
  }

  async getStatistics(workspaceId: string, period?: string): Promise<any> {
    const payrolls = await this.list(workspaceId, period ? { period } : {});

    const sum = (f: (p: any) => number) => payrolls.reduce((s, p) => s + (f(p) || 0), 0);
    const totalGrossSalary = sum(p => p.BaseSalary + p.Allowances + p.Bonuses);
    const totalNetSalary = sum(p => p.NetSalary);

    const statusDistribution = payrolls.reduce((acc: any, p: any) => {
      acc[p.Status] = (acc[p.Status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPayrolls: payrolls.length,
      totalGrossSalary,
      totalAllowances: sum(p => p.Allowances),
      totalBonuses: sum(p => p.Bonuses),
      totalDeductions: sum(p => p.Deductions),
      totalAdvanceDeductions: sum(p => p.AdvanceDeduction),
      totalNetSalary,
      averageNetSalary: payrolls.length > 0 ? totalNetSalary / payrolls.length : 0,
      statusDistribution,
      period: period || 'all',
    };
  }
}
