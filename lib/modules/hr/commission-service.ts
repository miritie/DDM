/**
 * Service - Gestion des Commissions des Employés
 * Module RH & Rémunérations
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Commission, CommissionStatus, CommissionType } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateCommissionInput {
  employeeId: string;
  employeeName: string;
  type: CommissionType;
  period: string; // YYYY-MM
  basedOnAmount?: number;
  commissionRate?: number;
  calculatedAmount: number;
  currency?: string;
  referenceId?: string;
  referenceType?: 'sale' | 'target' | 'performance';
  referenceNumber?: string;
  notes?: string;
  workspaceId: string;
}

export interface UpdateCommissionInput {
  status?: CommissionStatus;
  calculatedAmount?: number;
  paidDate?: string;
  payrollId?: string;
  notes?: string;
}

export interface CommissionFilters {
  employeeId?: string;
  status?: CommissionStatus;
  type?: CommissionType;
  period?: string;
  startDate?: string;
  endDate?: string;
  paid?: boolean;
}

export class CommissionService {
  /**
   * Créer une nouvelle commission
   */
  async create(input: CreateCommissionInput): Promise<Commission> {
    // Validation: montant calculé doit être positif
    if (input.calculatedAmount < 0) {
      throw new Error('Le montant de la commission doit être positif');
    }

    // Validation: période au format YYYY-MM
    const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!periodRegex.test(input.period)) {
      throw new Error('La période doit être au format YYYY-MM');
    }

    const commission: Partial<Commission> = {
      CommissionId: uuidv4(),
      EmployeeId: input.employeeId,
      EmployeeName: input.employeeName,
      Type: input.type,
      Status: 'pending',
      Period: input.period,
      BasedOnAmount: input.basedOnAmount,
      CommissionRate: input.commissionRate,
      CalculatedAmount: input.calculatedAmount,
      Currency: input.currency || 'XOF',
      ReferenceId: input.referenceId,
      ReferenceType: input.referenceType,
      ReferenceNumber: input.referenceNumber,
      Notes: input.notes,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<Commission>('Commission', commission);
    if (!created) {
      throw new Error('Failed to create commission - Airtable not configured');
    }
    return created;
  }

  /**
   * Récupérer une commission par son ID
   */
  async getById(commissionId: string): Promise<Commission | null> {
    const commissions = await airtableClient.list<Commission>('Commission', {
      filterByFormula: `{CommissionId} = '${commissionId}'`,
    });
    return commissions.length > 0 ? commissions[0] : null;
  }

  /**
   * Lister les commissions avec filtres
   */
  async list(workspaceId: string, filters: CommissionFilters = {}): Promise<Commission[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.employeeId) {
      filterFormulas.push(`{EmployeeId} = '${filters.employeeId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.type) {
      filterFormulas.push(`{Type} = '${filters.type}'`);
    }
    if (filters.period) {
      filterFormulas.push(`{Period} = '${filters.period}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{CreatedAt} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{CreatedAt} <= '${filters.endDate}'`);
    }
    if (filters.paid !== undefined) {
      if (filters.paid) {
        filterFormulas.push(`{Status} = 'paid'`);
      } else {
        filterFormulas.push(`OR({Status} = 'pending', {Status} = 'calculated')`);
      }
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<Commission>('Commission', {
      filterByFormula,
      sort: [{ field: 'Period', direction: 'desc' }],
    });
  }

  /**
   * Mettre à jour une commission
   */
  async update(commissionId: string, updates: UpdateCommissionInput): Promise<Commission> {
    const commissions = await airtableClient.list<Commission>('Commission', {
      filterByFormula: `{CommissionId} = '${commissionId}'`,
    });

    if (commissions.length === 0) {
      throw new Error('Commission non trouvée');
    }

    const commission = commissions[0];

    // Validation: ne peut pas modifier une commission déjà payée
    if (commission.Status === 'paid' && updates.status !== 'paid') {
      throw new Error('Impossible de modifier une commission déjà payée');
    }

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.status !== undefined) updateData.Status = updates.status;
    if (updates.calculatedAmount !== undefined)
      updateData.CalculatedAmount = updates.calculatedAmount;
    if (updates.paidDate !== undefined) updateData.PaidDate = updates.paidDate;
    if (updates.payrollId !== undefined) updateData.PayrollId = updates.payrollId;
    if (updates.notes !== undefined) updateData.Notes = updates.notes;

    const updated = await airtableClient.update<Commission>(
      'Commission',
      (commission as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update commission - Airtable not configured');
    }
    return updated;
  }

  /**
   * Marquer une commission comme calculée
   */
  async markAsCalculated(commissionId: string): Promise<Commission> {
    return await this.update(commissionId, { status: 'calculated' });
  }

  /**
   * Marquer une commission comme payée
   */
  async markAsPaid(
    commissionId: string,
    payrollId?: string,
    paidDate?: string
  ): Promise<Commission> {
    return await this.update(commissionId, {
      status: 'paid',
      payrollId,
      paidDate: paidDate || new Date().toISOString(),
    });
  }

  /**
   * Calculer les commissions sur ventes pour un employé
   */
  async calculateSalesCommissions(
    employeeId: string,
    period: string,
    workspaceId: string
  ): Promise<Commission[]> {
    // Récupérer les ventes de l'employé pour la période
    const [year, month] = period.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();

    // Récupérer les ventes de l'employé
    const sales = await airtableClient.list('Sale', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {SellerId} = '${employeeId}', {SaleDate} >= '${startDate}', {SaleDate} <= '${endDate}')`,
    });

    // Récupérer l'employé pour obtenir son taux de commission
    const employees = await airtableClient.list('Employee', {
      filterByFormula: `{EmployeeId} = '${employeeId}'`,
    });

    if (employees.length === 0) {
      throw new Error('Employé non trouvé');
    }

    const employee = employees[0] as any;

    if (!employee.CommissionEnabled) {
      return [];
    }

    const commissionRate = employee.CommissionRate || 0;
    const commissions: Commission[] = [];

    // Créer une commission pour chaque vente
    for (const sale of sales) {
      const saleData = sale as any;
      const commissionAmount = (saleData.TotalAmount * commissionRate) / 100;

      const commission = await this.create({
        employeeId,
        employeeName: employee.FullName,
        type: 'sales',
        period,
        basedOnAmount: saleData.TotalAmount,
        commissionRate,
        calculatedAmount: commissionAmount,
        currency: saleData.Currency,
        referenceId: saleData.SaleId,
        referenceType: 'sale',
        referenceNumber: saleData.SaleNumber,
        notes: `Commission sur vente ${saleData.SaleNumber}`,
        workspaceId,
      });

      commissions.push(commission);
    }

    return commissions;
  }

  /**
   * Calculer les commissions pour tous les employés d'une période
   */
  async calculateAllCommissions(period: string, workspaceId: string): Promise<Commission[]> {
    // Récupérer tous les employés actifs avec commission activée
    const employees = await airtableClient.list('Employee', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Status} = 'active', {CommissionEnabled} = 1)`,
    });

    const allCommissions: Commission[] = [];

    for (const employee of employees) {
      const employeeData = employee as any;
      const commissions = await this.calculateSalesCommissions(
        employeeData.EmployeeId,
        period,
        workspaceId
      );
      allCommissions.push(...commissions);
    }

    return allCommissions;
  }

  /**
   * Obtenir les commissions non payées d'un employé
   */
  async getUnpaidCommissions(employeeId: string): Promise<Commission[]> {
    return await airtableClient.list<Commission>('Commission', {
      filterByFormula: `AND({EmployeeId} = '${employeeId}', OR({Status} = 'pending', {Status} = 'calculated'))`,
      sort: [{ field: 'Period', direction: 'asc' }],
    });
  }

  /**
   * Obtenir le total des commissions pour un employé sur une période
   */
  async getTotalCommissions(
    employeeId: string,
    period: string
  ): Promise<{ total: number; byType: Record<CommissionType, number> }> {
    const commissions = await this.list('', { employeeId, period });

    const total = commissions.reduce((sum, c) => sum + c.CalculatedAmount, 0);

    const byType: Record<CommissionType, number> = {
      sales: 0,
      target_bonus: 0,
      performance_bonus: 0,
      manual: 0,
    };

    commissions.forEach((c) => {
      byType[c.Type] += c.CalculatedAmount;
    });

    return { total, byType };
  }

  /**
   * Obtenir les statistiques des commissions
   */
  async getStatistics(
    workspaceId: string,
    period?: string
  ): Promise<{
    totalCommissions: number;
    totalAmount: number;
    byStatus: Record<CommissionStatus, number>;
    byType: Record<CommissionType, number>;
    topEarners: Array<{ employeeId: string; employeeName: string; totalAmount: number }>;
  }> {
    const filters: CommissionFilters = {};
    if (period) filters.period = period;

    const commissions = await this.list(workspaceId, filters);

    const totalCommissions = commissions.length;
    const totalAmount = commissions.reduce((sum, c) => sum + c.CalculatedAmount, 0);

    // Par statut
    const byStatus: Record<CommissionStatus, number> = {
      pending: 0,
      calculated: 0,
      paid: 0,
    };
    commissions.forEach((c) => {
      byStatus[c.Status]++;
    });

    // Par type
    const byType: Record<CommissionType, number> = {
      sales: 0,
      target_bonus: 0,
      performance_bonus: 0,
      manual: 0,
    };
    commissions.forEach((c) => {
      byType[c.Type] += c.CalculatedAmount;
    });

    // Top 10 employés par commissions
    const employeeMap: Record<string, { employeeId: string; employeeName: string; totalAmount: number }> = {};
    commissions.forEach((c) => {
      if (!employeeMap[c.EmployeeId]) {
        employeeMap[c.EmployeeId] = {
          employeeId: c.EmployeeId,
          employeeName: c.EmployeeName,
          totalAmount: 0,
        };
      }
      employeeMap[c.EmployeeId].totalAmount += c.CalculatedAmount;
    });

    const topEarners = Object.values(employeeMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    return {
      totalCommissions,
      totalAmount,
      byStatus,
      byType,
      topEarners,
    };
  }

  /**
   * Supprimer une commission (seulement si pending)
   */
  async delete(commissionId: string): Promise<void> {
    const commissions = await airtableClient.list<Commission>('Commission', {
      filterByFormula: `{CommissionId} = '${commissionId}'`,
    });

    if (commissions.length === 0) {
      throw new Error('Commission non trouvée');
    }

    const commission = commissions[0];

    if (commission.Status !== 'pending') {
      throw new Error('Seules les commissions en attente peuvent être supprimées');
    }

    await airtableClient.delete('Commission', (commission as any)._recordId);
  }
}
