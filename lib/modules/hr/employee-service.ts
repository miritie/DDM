/**
 * Service - Gestion des Employés
 * Module Ressources Humaines
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Employee, HRStatistics, Leave } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { ensurePayrollTable } from './payroll-service';
import { computeFiscalParts } from './payroll-ci';

const postgresClient = getPostgresClient();

export interface EmployeePayrollFields {
  /** permanent (CDI) | temporary (CDD / journalier) | contractor | intern */
  contractType?: 'permanent' | 'temporary' | 'contractor' | 'intern';
  /** cadre | agent_maitrise | employe | ouvrier | journalier */
  category?: string;
  maritalStatus?: 'celibataire' | 'marie' | 'divorce' | 'veuf';
  childrenCount?: number;
  cnpsNumber?: string;
  /** Salarié déclaré : assujetti CNPS/ITS/CMU/FDFP (true par défaut) */
  cnpsSubject?: boolean;
  cmuBeneficiaries?: number;
  /** journaliers : salaire = taux × jours travaillés */
  dailyRate?: number | null;
  /** prime de transport versée chaque jour de présence (2 500 F défaut) */
  transportDaily?: number;
  educationLevel?: string;
  diploma?: string;
}

export interface CreateEmployeeInput extends EmployeePayrollFields {
  firstName: string;
  lastName: string;
  phone: string; // NOT NULL en base
  email?: string;
  dateOfBirth?: string;
  hireDate: string;
  department?: string;
  position: string;
  baseSalary: number;
  currency?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  workspaceId: string;
}

export interface UpdateEmployeeInput extends EmployeePayrollFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  hireDate?: string;
  department?: string;
  position?: string;
  baseSalary?: number;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  status?: 'active' | 'inactive' | 'suspended' | 'terminated';
}

/**
 * Service de gestion des employés
 */
export class EmployeeService {
  /**
   * Génère un numéro d'employé unique
   */
  async generateEmployeeNumber(workspaceId: string): Promise<string> {
    const employees = await postgresClient.list<Employee>('employees', {
      where: { workspace_id: workspaceId },
    });

    const count = employees.length + 1;
    return `EMP-${String(count).padStart(4, '0')}`;
  }

  /**
   * Crée un nouvel employé — SQL direct, aligné sur le schéma réel
   * (l'ancienne version envoyait 'CDI' dans l'enum contract_type
   * permanent/temporary/…, sans full_name ni phone NOT NULL : la
   * création n'a jamais pu aboutir). Les parts fiscales sont déduites
   * de l'état civil (quotient familial CI).
   */
  async create(input: CreateEmployeeInput): Promise<Employee | null> {
    await ensurePayrollTable(); // colonnes RH/paie garanties
    if (!input.phone?.trim()) throw new Error('Le téléphone est requis');
    const fullName = `${input.lastName.trim()} ${input.firstName.trim()}`.trim();
    const fiscalParts = computeFiscalParts(input.maritalStatus, input.childrenCount ?? 0);

    const seqR = await postgresClient.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(employee_code, '\\D', '', 'g'), '')::int), 0) + 1 AS next
       FROM employees WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const code = `EMP-${String(seqR.rows[0].next).padStart(4, '0')}`;

    const r = await postgresClient.query(
      `INSERT INTO employees (employee_id, employee_code, first_name, last_name, full_name,
                              phone, email, date_of_birth, hire_date, department, position,
                              contract_type, category, base_salary, currency, daily_rate,
                              transport_daily, marital_status, children_count, fiscal_parts,
                              cnps_number, cnps_subject, cmu_beneficiaries, education_level, diploma,
                              address, emergency_contact, emergency_phone, workspace_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
               $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
       RETURNING id`,
      [uuidv4(), code, input.firstName.trim(), input.lastName.trim(), fullName,
       input.phone.trim(), input.email ?? null, input.dateOfBirth ?? null, input.hireDate,
       input.department ?? null, input.position,
       input.contractType ?? 'permanent', input.category ?? null,
       input.baseSalary, input.currency || 'XOF', input.dailyRate ?? null,
       input.transportDaily ?? 2500, input.maritalStatus ?? 'celibataire',
       input.childrenCount ?? 0, fiscalParts,
       input.cnpsNumber ?? null, input.cnpsSubject !== false, input.cmuBeneficiaries ?? 1,
       input.educationLevel ?? null, input.diploma ?? null,
       input.address ?? null, input.emergencyContact ?? null, input.emergencyPhone ?? null,
       input.workspaceId]
    );
    return postgresClient.get<Employee>('employees', r.rows[0].id);
  }

  /**
   * Récupère un employé par ID
   */
  async getById(employeeId: string): Promise<Employee | null> {
    await ensurePayrollTable();
    const r = await postgresClient.query(
      `SELECT id FROM employees WHERE id::text = $1 OR employee_id = $1 LIMIT 1`,
      [employeeId]
    );
    return r.rows[0] ? postgresClient.get<Employee>('employees', r.rows[0].id) : null;
  }

  /**
   * Liste tous les employés d'un workspace
   */
  async list(
    workspaceId: string,
    filters: {
      status?: string;
      department?: string;
      contractType?: string;
    } = {}
  ): Promise<Employee[]> {
    // Égalités simples : option where{} paramétrée (les formules sans
    // accolades étaient silencieusement ignorées par le parseur)
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (filters.status) where.status = filters.status;
    if (filters.department) where.department = filters.department;
    if (filters.contractType) where.contract_type = filters.contractType;

    return await postgresClient.list<Employee>('employees', {
      where,
      sort: [{ field: 'LastName', direction: 'asc' }],
    });
  }

  /**
   * Met à jour un employé
   */
  async update(employeeId: string, input: UpdateEmployeeInput): Promise<Employee> {
    await ensurePayrollTable();
    const found = await postgresClient.query(
      `SELECT id, marital_status, children_count, first_name, last_name
       FROM employees WHERE id::text = $1 OR employee_id = $1 LIMIT 1`,
      [employeeId]
    );
    if (!found.rows[0]) throw new Error('Employé non trouvé');
    const current = found.rows[0];

    const sets: string[] = [`updated_at = CURRENT_TIMESTAMP`];
    const params: any[] = [];
    const set = (col: string, val: any) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (input.firstName !== undefined) set('first_name', input.firstName.trim());
    if (input.lastName !== undefined) set('last_name', input.lastName.trim());
    if (input.firstName !== undefined || input.lastName !== undefined) {
      set('full_name', `${(input.lastName ?? current.last_name).trim()} ${(input.firstName ?? current.first_name).trim()}`);
    }
    if (input.email !== undefined) set('email', input.email || null);
    if (input.phone !== undefined) set('phone', input.phone);
    if (input.dateOfBirth !== undefined) set('date_of_birth', input.dateOfBirth || null);
    if (input.hireDate !== undefined) set('hire_date', input.hireDate);
    if (input.department !== undefined) set('department', input.department || null);
    if (input.position !== undefined) set('position', input.position);
    if (input.baseSalary !== undefined) set('base_salary', input.baseSalary);
    if (input.contractType !== undefined) set('contract_type', input.contractType);
    if (input.category !== undefined) set('category', input.category || null);
    if (input.dailyRate !== undefined) set('daily_rate', input.dailyRate);
    if (input.transportDaily !== undefined) set('transport_daily', input.transportDaily);
    if (input.cnpsNumber !== undefined) set('cnps_number', input.cnpsNumber || null);
    if (input.cnpsSubject !== undefined) set('cnps_subject', input.cnpsSubject);
    if (input.cmuBeneficiaries !== undefined) set('cmu_beneficiaries', input.cmuBeneficiaries);
    if (input.educationLevel !== undefined) set('education_level', input.educationLevel || null);
    if (input.diploma !== undefined) set('diploma', input.diploma || null);
    if (input.address !== undefined) set('address', input.address || null);
    if (input.emergencyContact !== undefined) set('emergency_contact', input.emergencyContact || null);
    if (input.emergencyPhone !== undefined) set('emergency_phone', input.emergencyPhone || null);
    if (input.status !== undefined) set('status', input.status);

    // État civil → parts fiscales recalculées (quotient familial CI)
    if (input.maritalStatus !== undefined || input.childrenCount !== undefined) {
      const marital = input.maritalStatus ?? current.marital_status;
      const children = input.childrenCount ?? current.children_count ?? 0;
      if (input.maritalStatus !== undefined) set('marital_status', marital);
      if (input.childrenCount !== undefined) set('children_count', children);
      set('fiscal_parts', computeFiscalParts(marital, children));
    }

    params.push(current.id);
    await postgresClient.query(
      `UPDATE employees SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );
    return (await postgresClient.get<Employee>('employees', current.id))!;
  }

  /**
   * Termine le contrat d'un employé
   */
  async terminate(
    employeeId: string,
    terminationDate: string,
    reason?: string
  ): Promise<Employee> {
    return await this.update(employeeId, {
      status: 'terminated',
    });
  }

  /**
   * Recherche d'employés
   */
  async search(workspaceId: string, query: string): Promise<Employee[]> {
    const employees = await this.list(workspaceId, { status: 'active' });

    if (!query) return employees;

    const lowercaseQuery = query.toLowerCase();
    return employees.filter(
      (e) =>
        e.FirstName.toLowerCase().includes(lowercaseQuery) ||
        e.LastName.toLowerCase().includes(lowercaseQuery) ||
        ((e as any).EmployeeCode || (e as any).EmployeeNumber)?.toLowerCase().includes(lowercaseQuery) ||
        e.Email?.toLowerCase().includes(lowercaseQuery) ||
        (e as any).Phone?.includes(query) ||
        e.Department?.toLowerCase().includes(lowercaseQuery) ||
        e.Position.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Récupère les statistiques RH
   */
  async getStatistics(workspaceId: string): Promise<HRStatistics> {
    const employees = await this.list(workspaceId);
    const activeEmployees = employees.filter((e) => e.Status === 'active');
    const onLeaveEmployees = employees.filter((e) => (e as any).Status === 'on_leave');

    // pg renvoie les NUMERIC en string : Number() obligatoire sinon
    // la somme CONCATÈNE (« 0150000350000… »)
    const totalPayroll = activeEmployees.reduce(
      (sum, e) => sum + (Number(e.BaseSalary) || 0),
      0
    );
    const averageSalary =
      activeEmployees.length > 0 ? totalPayroll / activeEmployees.length : 0;

    // Department distribution
    const departmentMap = new Map<string, number>();
    for (const emp of activeEmployees) {
      const dept = emp.Department || 'Non assigné';
      departmentMap.set(dept, (departmentMap.get(dept) || 0) + 1);
    }
    const departmentDistribution = Array.from(departmentMap.entries()).map(
      ([department, count]) => ({ department, count })
    );

    // Contract type distribution
    const contractMap = new Map<string, number>();
    for (const emp of activeEmployees) {
      contractMap.set(emp.ContractType, (contractMap.get(emp.ContractType) || 0) + 1);
    }
    const contractTypeDistribution = Array.from(contractMap.entries()).map(
      ([type, count]) => ({ type, count })
    );

    // Get pending leaves
    const leaves = await postgresClient.list<Leave>('leaves', {
      filterByFormula: `AND(workspace_id = '${workspaceId}', status = 'pending')`,
    });

    // Get upcoming leaves
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const approvedLeaves = await postgresClient.list<Leave>('leaves', {
      filterByFormula: `AND(workspace_id = '${workspaceId}', status = 'approved')`,
    });

    const upcomingLeaves = approvedLeaves
      .filter((leave) => {
        const startDate = new Date(leave.StartDate);
        return startDate >= now && startDate <= nextMonth;
      })
      .map((leave) => {
        const employee = employees.find((e) => e.EmployeeId === leave.EmployeeId);
        return {
          employeeId: leave.EmployeeId,
          employeeName: employee
            ? `${employee.FirstName} ${employee.LastName}`
            : 'Employé inconnu',
          startDate: leave.StartDate,
          endDate: leave.EndDate,
          type: leave.Type,
        };
      });

    return {
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      onLeaveEmployees: onLeaveEmployees.length,
      totalPayroll,
      averageSalary,
      departmentDistribution,
      contractTypeDistribution,
      attendanceRate: 0, // Will be calculated by attendance service
      pendingLeaves: leaves.length,
      upcomingLeaves,
    };
  }
}
