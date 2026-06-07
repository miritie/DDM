/**
 * Service - Gestion des Employés
 * Module Ressources Humaines
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Employee, HRStatistics, Leave } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  hireDate: string;
  department?: string;
  position: string;
  contractType: 'CDI' | 'CDD' | 'Stage' | 'Freelance' | 'Other';
  baseSalary: number;
  currency?: string;
  bankAccount?: string;
  taxNumber?: string;
  socialSecurityNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  workspaceId: string;
}

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  baseSalary?: number;
  bankAccount?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  status?: 'active' | 'on_leave' | 'terminated' | 'suspended';
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
   * Crée un nouvel employé
   */
  async create(input: CreateEmployeeInput): Promise<Employee> {
    const employeeNumber = await this.generateEmployeeNumber(input.workspaceId);

    const employee: any = {
      EmployeeId: uuidv4(),
      EmployeeNumber: employeeNumber,
      FirstName: input.firstName,
      LastName: input.lastName,
      Email: input.email,
      Phone: input.phone,
      DateOfBirth: input.dateOfBirth,
      HireDate: input.hireDate,
      Department: input.department,
      Position: input.position,
      ContractType: input.contractType,
      BaseSalary: input.baseSalary,
      Currency: input.currency || 'XOF',
      BankAccount: input.bankAccount,
      TaxNumber: input.taxNumber,
      SocialSecurityNumber: input.socialSecurityNumber,
      Address: input.address,
      EmergencyContact: input.emergencyContact,
      EmergencyPhone: input.emergencyPhone,
      Status: 'active',
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Employee>('employees', employee);
    return created;
  }

  /**
   * Récupère un employé par ID
   */
  async getById(employeeId: string): Promise<Employee | null> {
    const employees = await postgresClient.list<Employee>('employees', {
      where: { employee_id: employeeId },
    });

    return employees.length > 0 ? employees[0] : null;
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
    const employees = await postgresClient.list<Employee>('employees', {
      where: { employee_id: employeeId },
    });

    if (employees.length === 0) {
      throw new Error('Employé non trouvé');
    }

    const updates: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (input.firstName !== undefined) updates.FirstName = input.firstName;
    if (input.lastName !== undefined) updates.LastName = input.lastName;
    if (input.email !== undefined) updates.Email = input.email;
    if (input.phone !== undefined) updates.Phone = input.phone;
    if (input.department !== undefined) updates.Department = input.department;
    if (input.position !== undefined) updates.Position = input.position;
    if (input.baseSalary !== undefined) updates.BaseSalary = input.baseSalary;
    if (input.bankAccount !== undefined) updates.BankAccount = input.bankAccount;
    if (input.address !== undefined) updates.Address = input.address;
    if (input.emergencyContact !== undefined) updates.EmergencyContact = input.emergencyContact;
    if (input.emergencyPhone !== undefined) updates.EmergencyPhone = input.emergencyPhone;
    if (input.status !== undefined) updates.Status = input.status;

    if (!employees[0].id) {
      throw new Error('Employee ID is missing');
    }

    const updated = await postgresClient.update<Employee>(
      'employees',
      employees[0].id,
      updates
    );
    return updated;
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

    const totalPayroll = activeEmployees.reduce(
      (sum, e) => sum + e.BaseSalary,
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
