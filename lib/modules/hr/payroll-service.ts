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
import { computeCIPayroll, computeFiscalParts } from './payroll-ci';

const postgresClient = getPostgresClient();
const paymentMethodService = new PaymentMethodService();

// La base de prod (Vercel) n'est jamais passée par les scripts de
// migration : la table payrolls peut ne pas exister. Garantie paresseuse
// et idempotente, une fois par process (même approche que doc_counters).
let payrollTableEnsured: Promise<void> | null = null;
export function ensurePayrollTable(): Promise<void> {
  if (!payrollTableEnsured) {
    payrollTableEnsured = (async () => {
      await postgresClient.query(
        `DO $$ BEGIN
           CREATE TYPE payroll_status AS ENUM ('draft', 'validated', 'paid', 'cancelled');
         EXCEPTION WHEN duplicate_object THEN NULL; END $$`
      );
      await postgresClient.query(
        `CREATE TABLE IF NOT EXISTS payrolls (
           id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
           payroll_id VARCHAR(50) UNIQUE NOT NULL,
           payroll_number VARCHAR(50) NOT NULL,
           employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
           period VARCHAR(7) NOT NULL,
           base_salary DECIMAL(15, 2) NOT NULL,
           allowances DECIMAL(15, 2) DEFAULT 0 NOT NULL,
           bonuses DECIMAL(15, 2) DEFAULT 0 NOT NULL,
           deductions DECIMAL(15, 2) DEFAULT 0 NOT NULL,
           advance_deduction DECIMAL(15, 2) DEFAULT 0 NOT NULL,
           net_salary DECIMAL(15, 2) NOT NULL,
           payment_date DATE,
           payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT,
           status payroll_status DEFAULT 'draft' NOT NULL,
           notes TEXT,
           processed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
           processed_at TIMESTAMP,
           workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
           updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
         )`
      );
      // Bases déjà migrées mais antérieures à 2a : colonne paiement moderne
      await postgresClient.query(
        `ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE RESTRICT`
      );
      // ----- Paie conforme CI (ITS/CNPS/CMU/FDFP) : détail du bulletin -----
      for (const col of [
        `days_worked INT`,
        `gross_taxable DECIMAL(15, 2)`,
        `gross_total DECIMAL(15, 2)`,
        `transport_allowance DECIMAL(15, 2) DEFAULT 0`,
        `meal_allowance DECIMAL(15, 2) DEFAULT 0`,
        `sales_bonus DECIMAL(15, 2) DEFAULT 0`,
        `cnps_employee DECIMAL(15, 2) DEFAULT 0`,
        `its_amount DECIMAL(15, 2) DEFAULT 0`,
        `ricf DECIMAL(15, 2) DEFAULT 0`,
        `employer_charges JSONB`,
        `employer_total DECIMAL(15, 2) DEFAULT 0`,
        `fiscal_parts NUMERIC(3, 1)`,
        `charges_settled_at TIMESTAMP`,
      ]) {
        await postgresClient.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS ${col}`);
      }
      // ----- Paramètres de paie sur la fiche employé -----
      for (const col of [
        `fiscal_parts NUMERIC(3, 1) DEFAULT 1`,
        `cnps_number VARCHAR(50)`,
        `cmu_beneficiaries INT DEFAULT 1`,
        `daily_rate DECIMAL(15, 2)`,
        `transport_daily DECIMAL(15, 2) DEFAULT 2500`,
        `work_accident_rate NUMERIC(4, 3) DEFAULT 0.02`,
        `cnps_subject BOOLEAN DEFAULT true`,
        `marital_status VARCHAR(20) DEFAULT 'celibataire'`,
        `children_count INT DEFAULT 0`,
        `category VARCHAR(50)`,
        `education_level VARCHAR(100)`,
        `diploma VARCHAR(150)`,
      ]) {
        await postgresClient.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS ${col}`);
      }
      // ----- Primes payées en espèces à la clôture de caisse -----
      await postgresClient.query(
        `CREATE TABLE IF NOT EXISTS commission_payouts (
           id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
           payout_date DATE NOT NULL,
           outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
           seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           kind VARCHAR(20) NOT NULL,
           units INT DEFAULT 0 NOT NULL,
           amount DECIMAL(15, 2) NOT NULL,
           wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
           transaction_id UUID,
           pos_session_id UUID,
           workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
           created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
           UNIQUE (seller_user_id, outlet_id, payout_date, kind)
         )`
      );
    })().catch(e => { payrollTableEnsured = null; throw e; });
  }
  return payrollTableEnsured;
}

export interface CreatePayrollInput {
  employeeId: string; // UUID employees.id OU code métier employees.employee_id
  period: string; // YYYY-MM
  baseSalary?: number;
  allowances?: number; // indemnités imposables
  bonuses?: number; // primes imposables saisies à la main
  deductions?: number; // autres retenues (avances sur salaire…)
  daysWorked?: number; // journaliers : jours travaillés du mois
  mealAllowance?: number; // prime de panier (exonérée ≤ 30 000)
  transportAllowance?: number; // forcé — sinon repris des primes espèces versées
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
         p.workspace_id AS "WorkspaceId", p.created_at AS "CreatedAt",
         p.days_worked AS "DaysWorked", p.fiscal_parts::float AS "FiscalParts",
         p.gross_taxable::float AS "GrossTaxable", p.gross_total::float AS "GrossTotal",
         p.transport_allowance::float AS "TransportAllowance", p.meal_allowance::float AS "MealAllowance",
         p.sales_bonus::float AS "SalesBonus", p.cnps_employee::float AS "CnpsEmployee",
         p.its_amount::float AS "ItsAmount", p.ricf::float AS "Ricf",
         p.employer_charges AS "EmployerCharges", p.employer_total::float AS "EmployerTotal",
         p.charges_settled_at AS "ChargesSettledAt",
         e.contract_type AS "ContractType", e.position AS "Position",
         e.cnps_number AS "CnpsNumber", e.hire_date AS "HireDate", e.department AS "Department",
         e.cnps_subject AS "CnpsSubject"
  FROM payrolls p
  LEFT JOIN employees e ON e.id = p.employee_id`;

export class PayrollService {
  private async findEmployee(workspaceId: string, employeeRef: string) {
    const r = await postgresClient.query(
      `SELECT id, employee_id, full_name, base_salary::float AS base_salary,
              contract_type, department, user_id,
              daily_rate::float AS daily_rate, transport_daily::float AS transport_daily,
              fiscal_parts::float AS fiscal_parts, cmu_beneficiaries,
              work_accident_rate::float AS work_accident_rate,
              marital_status, children_count, cnps_subject
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
    await ensurePayrollTable();
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
    await ensurePayrollTable();
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
    await ensurePayrollTable();
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

    // ----- Primes déjà versées en espèces (clôtures de caisse du mois) -----
    // Transport : exonéré ≤ 30 000/mois ; prime de vente : imposable.
    // Les deux sont des ACOMPTES — déjà dans la poche du commercial.
    let transportPaid = 0;
    let salesBonusPaid = 0;
    let payoutDays = 0;
    if (employee.user_id) {
      const payoutsR = await postgresClient.query(
        `SELECT kind, COALESCE(SUM(amount), 0)::float AS total,
                COUNT(DISTINCT payout_date)::int AS days
         FROM commission_payouts
         WHERE workspace_id = $1 AND seller_user_id = $2
           AND to_char(payout_date, 'YYYY-MM') = $3
         GROUP BY kind`,
        [input.workspaceId, employee.user_id, input.period]
      );
      for (const row of payoutsR.rows) {
        if (row.kind === 'transport') { transportPaid = row.total; payoutDays = row.days; }
        if (row.kind === 'sales_bonus') salesBonusPaid = row.total;
      }
    }

    // ----- Salaire de base selon le contrat -----
    const isDaily = ['daily', 'journalier', 'temporary'].includes(String(employee.contract_type || ''));
    const daysWorked = input.daysWorked ?? (payoutDays > 0 ? payoutDays : null);
    let baseSalary = input.baseSalary ?? employee.base_salary ?? 0;
    if (input.baseSalary == null && isDaily && employee.daily_rate) {
      if (!daysWorked) {
        throw new Error(`${employee.full_name} est journalier : préciser les jours travaillés du mois`);
      }
      baseSalary = employee.daily_rate * daysWorked;
    }

    const allowances = input.allowances || 0;
    const bonuses = input.bonuses || 0;
    const deductions = input.deductions || 0;
    const transportAllowance = input.transportAllowance ?? transportPaid;
    const mealAllowance = input.mealAllowance || 0;
    const cashAlreadyPaid = transportPaid + salesBonusPaid;

    // ----- Calcul conforme CI (ITS barème 2023-719, CNPS, CMU, FDFP) -----
    const calc = computeCIPayroll({
      baseSalary,
      taxableBonuses: allowances + bonuses + salesBonusPaid,
      transportAllowance,
      mealAllowance,
      otherDeductions: deductions,
      cashAlreadyPaid,
      fiscalParts: computeFiscalParts(employee.marital_status, employee.children_count)
        || employee.fiscal_parts || 1,
      cmuBeneficiaries: employee.cmu_beneficiaries ?? 1,
      workAccidentRate: employee.work_accident_rate || undefined,
      subjectToLegalCharges: employee.cnps_subject !== false,
    });

    const payrollId = uuidv4();
    const number = await this.nextNumber(input.workspaceId, input.period);
    await postgresClient.query(
      `INSERT INTO payrolls (payroll_id, payroll_number, employee_id, period, base_salary,
                             allowances, bonuses, deductions, advance_deduction, net_salary,
                             status, notes, workspace_id,
                             days_worked, gross_taxable, gross_total, transport_allowance,
                             meal_allowance, sales_bonus, cnps_employee, its_amount, ricf,
                             employer_charges, employer_total, fiscal_parts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, $12,
               $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [payrollId, number, employee.id, input.period, baseSalary,
       allowances, bonuses, deductions, cashAlreadyPaid, calc.netToPay,
       input.notes ?? null, input.workspaceId,
       daysWorked, calc.grossTaxable, calc.grossTotal, transportAllowance,
       mealAllowance, salesBonusPaid, calc.employee.cnpsRetirement, calc.employee.its,
       calc.employee.ricf, JSON.stringify(calc.employer), calc.employer.total,
       computeFiscalParts(employee.marital_status, employee.children_count) || employee.fiscal_parts || 1]
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

    // ----- Sortie de trésorerie réelle (le net quitte un wallet) -----
    const walletType = input.paymentMethod === 'cash' ? 'cash'
      : input.paymentMethod === 'mobile_money' ? 'mobile_money' : 'bank';
    const net = Number(payroll.NetSalary) || 0;
    let walletAccountId: string | null = null;
    if (net > 0) {
      walletAccountId = await postgresClient.transaction(async (client) => {
        const wR = await client.query(
          `SELECT id, balance::float AS balance, chart_account_id
           FROM wallets
           WHERE workspace_id = $1 AND type = $2 AND is_active = true
             AND ($2 != 'cash' OR outlet_id IS NULL)
           ORDER BY name LIMIT 1 FOR UPDATE`,
          [payroll.WorkspaceId, walletType]
        );
        if (!wR.rows[0]) {
          throw new Error(`Aucun portefeuille « ${walletType} » actif pour payer cette paie`);
        }
        const wallet = wR.rows[0];
        if (wallet.balance < net) {
          throw new Error(`Solde insuffisant (${Math.round(wallet.balance)} F) pour verser le net de ${Math.round(net)} F`);
        }
        await client.query(
          `INSERT INTO transactions (transaction_id, transaction_number, type, category, amount,
                                     source_wallet_id, description, reference, status,
                                     processed_by_id, processed_at, workspace_id)
           VALUES ($1, $2, 'expense', 'salary', $3, $4, $5, $6, 'completed', $7, CURRENT_TIMESTAMP, $8)`,
          [uuidv4(), `SAL-${payroll.Period.replace('-', '')}-${uuidv4().slice(0, 12)}`,
           net, wallet.id,
           `Salaire ${payroll.Period} — ${payroll.EmployeeName ?? payroll.PayrollNumber}`,
           payroll.PayrollNumber, input.processedById, payroll.WorkspaceId]
        );
        await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`, [net, wallet.id]);
        return wallet.chart_account_id as string | null;
      });
    }

    await postgresClient.query(
      `UPDATE payrolls
       SET status = 'paid', payment_date = $2, payment_method_id = $3,
           processed_by_id = $4, processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [payroll.Id, input.paymentDate, pm.Id, input.processedById]
    );

    // ----- Écriture comptable de paie (best-effort) : matérialise les
    // dettes sociales (431) et fiscales (442/447) à régler le 15 -----
    try {
      const { JournalGenerationService } = await import('@/lib/modules/accounting/journal-generation-service');
      await new JournalGenerationService().fromPayrollPayment(payroll.Id, {
        treasuryAccountId: walletAccountId,
        journalCode: input.paymentMethod === 'cash' ? 'CAI' : 'BAN',
      });
    } catch (e: any) {
      console.warn('[payroll] écriture de paie sautée:', e.message);
    }

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
    await ensurePayrollTable();
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
      try {
        // create() applique le contrat (journalier = taux × jours issus
        // des présences primées) et reprend les primes espèces du mois
        payrolls.push(await this.create({
          employeeId: employee.id,
          period,
          workspaceId,
        }));
      } catch (e: any) {
        // ex. journalier sans jours renseignés : à créer individuellement
        console.warn(`Paie sautée pour ${employee.full_name}: ${e.message}`);
      }
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
