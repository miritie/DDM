/**
 * Service - Gestion des Avances sur Salaire
 * Module RH & Rémunérations
 */

import { AirtableClient } from '@/lib/airtable/client';
import { EmployeeAdvance } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface CreateEmployeeAdvanceInput {
  employeeId: string;
  employeeName: string;
  amount: number;
  currency?: string;
  reason?: string;
  workspaceId: string;
}

export interface ApproveAdvanceInput {
  approvedById: string;
  approvedByName: string;
}

export interface PayAdvanceInput {
  paymentDate: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'mobile_money';
  walletId?: string;
  transactionId?: string;
}

export interface DeductAdvanceInput {
  deductionPayrollId: string;
  deductionDate: string;
}

export interface EmployeeAdvanceFilters {
  employeeId?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'paid' | 'deducted';
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export class EmployeeAdvanceService {
  /**
   * Générer le numéro d'avance (ADV-202411-0001)
   */
  async generateAdvanceNumber(workspaceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', YEAR({CreatedAt}) = ${year}, MONTH({CreatedAt}) = ${parseInt(month)})`,
    });
    return `ADV-${year}${month}-${String(advances.length + 1).padStart(4, '0')}`;
  }

  /**
   * Créer une nouvelle demande d'avance
   */
  async create(input: CreateEmployeeAdvanceInput): Promise<EmployeeAdvance> {
    // Validation: montant positif
    if (input.amount <= 0) {
      throw new Error('Le montant de l\'avance doit être positif');
    }

    // Vérifier que l'employé existe et est actif
    const employees = await airtableClient.list('Employee', {
      filterByFormula: `{EmployeeId} = '${input.employeeId}'`,
    });

    if (employees.length === 0) {
      throw new Error('Employé non trouvé');
    }

    const employee = employees[0] as any;

    if (employee.Status !== 'active') {
      throw new Error('Seuls les employés actifs peuvent demander une avance');
    }

    // Vérifier le montant maximal autorisé (50% du salaire de base)
    const maxAdvance = employee.BaseSalary * 0.5;
    if (input.amount > maxAdvance) {
      throw new Error(
        `Le montant de l'avance ne peut pas dépasser 50% du salaire de base (${maxAdvance} ${employee.Currency})`
      );
    }

    // Vérifier qu'il n'y a pas d'avance en cours (pending, approved, paid)
    const activeAdvances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `AND({EmployeeId} = '${input.employeeId}', OR({Status} = 'pending', {Status} = 'approved', {Status} = 'paid'))`,
    });

    if (activeAdvances.length > 0) {
      throw new Error('Une avance est déjà en cours pour cet employé');
    }

    const advanceNumber = await this.generateAdvanceNumber(input.workspaceId);

    const advance: Partial<EmployeeAdvance> = {
      AdvanceId: uuidv4(),
      AdvanceNumber: advanceNumber,
      EmployeeId: input.employeeId,
      EmployeeName: input.employeeName,
      Amount: input.amount,
      Currency: input.currency || 'XOF',
      Reason: input.reason,
      RequestDate: new Date().toISOString(),
      Status: 'pending',
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<EmployeeAdvance>('EmployeeAdvance', advance);
  }

  /**
   * Récupérer une avance par son ID
   */
  async getById(advanceId: string): Promise<EmployeeAdvance | null> {
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `{AdvanceId} = '${advanceId}'`,
    });
    return advances.length > 0 ? advances[0] : null;
  }

  /**
   * Récupérer une avance par son numéro
   */
  async getByNumber(advanceNumber: string, workspaceId: string): Promise<EmployeeAdvance | null> {
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {AdvanceNumber} = '${advanceNumber}')`,
    });
    return advances.length > 0 ? advances[0] : null;
  }

  /**
   * Lister les avances avec filtres
   */
  async list(workspaceId: string, filters: EmployeeAdvanceFilters = {}): Promise<EmployeeAdvance[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.employeeId) {
      filterFormulas.push(`{EmployeeId} = '${filters.employeeId}'`);
    }
    if (filters.status) {
      filterFormulas.push(`{Status} = '${filters.status}'`);
    }
    if (filters.startDate) {
      filterFormulas.push(`{RequestDate} >= '${filters.startDate}'`);
    }
    if (filters.endDate) {
      filterFormulas.push(`{RequestDate} <= '${filters.endDate}'`);
    }
    if (filters.minAmount !== undefined) {
      filterFormulas.push(`{Amount} >= ${filters.minAmount}`);
    }
    if (filters.maxAmount !== undefined) {
      filterFormulas.push(`{Amount} <= ${filters.maxAmount}`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula,
      sort: [{ field: 'RequestDate', direction: 'desc' }],
    });
  }

  /**
   * Approuver une avance
   */
  async approve(advanceId: string, input: ApproveAdvanceInput): Promise<EmployeeAdvance> {
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `{AdvanceId} = '${advanceId}'`,
    });

    if (advances.length === 0) {
      throw new Error('Avance non trouvée');
    }

    const advance = advances[0];

    if (advance.Status !== 'pending') {
      throw new Error('Seules les avances en attente peuvent être approuvées');
    }

    return await airtableClient.update<EmployeeAdvance>('EmployeeAdvance', (advance as any)._recordId, {
      Status: 'approved',
      ApprovedById: input.approvedById,
      ApprovedByName: input.approvedByName,
      ApprovedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Rejeter une avance
   */
  async reject(advanceId: string, reason?: string): Promise<EmployeeAdvance> {
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `{AdvanceId} = '${advanceId}'`,
    });

    if (advances.length === 0) {
      throw new Error('Avance non trouvée');
    }

    const advance = advances[0];

    if (advance.Status !== 'pending') {
      throw new Error('Seules les avances en attente peuvent être rejetées');
    }

    const updateData: any = {
      Status: 'rejected',
      UpdatedAt: new Date().toISOString(),
    };

    if (reason) {
      updateData.Notes = advance.Notes ? `${advance.Notes}\n\nRejet: ${reason}` : `Rejet: ${reason}`;
    }

    return await airtableClient.update<EmployeeAdvance>('EmployeeAdvance', (advance as any)._recordId, updateData);
  }

  /**
   * Payer une avance
   */
  async pay(advanceId: string, input: PayAdvanceInput): Promise<EmployeeAdvance> {
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `{AdvanceId} = '${advanceId}'`,
    });

    if (advances.length === 0) {
      throw new Error('Avance non trouvée');
    }

    const advance = advances[0];

    if (advance.Status !== 'approved') {
      throw new Error('Seules les avances approuvées peuvent être payées');
    }

    return await airtableClient.update<EmployeeAdvance>('EmployeeAdvance', (advance as any)._recordId, {
      Status: 'paid',
      PaymentDate: input.paymentDate,
      PaymentMethod: input.paymentMethod,
      WalletId: input.walletId,
      TransactionId: input.transactionId,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Marquer une avance comme déduite (après déduction sur paie)
   */
  async markAsDeducted(advanceId: string, input: DeductAdvanceInput): Promise<EmployeeAdvance> {
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `{AdvanceId} = '${advanceId}'`,
    });

    if (advances.length === 0) {
      throw new Error('Avance non trouvée');
    }

    const advance = advances[0];

    if (advance.Status !== 'paid') {
      throw new Error('Seules les avances payées peuvent être marquées comme déduites');
    }

    return await airtableClient.update<EmployeeAdvance>('EmployeeAdvance', (advance as any)._recordId, {
      Status: 'deducted',
      DeductionPayrollId: input.deductionPayrollId,
      DeductionDate: input.deductionDate,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Obtenir les avances en attente d'approbation
   */
  async getPendingApprovals(workspaceId: string): Promise<EmployeeAdvance[]> {
    return await this.list(workspaceId, { status: 'pending' });
  }

  /**
   * Obtenir les avances approuvées en attente de paiement
   */
  async getPendingPayments(workspaceId: string): Promise<EmployeeAdvance[]> {
    return await this.list(workspaceId, { status: 'approved' });
  }

  /**
   * Obtenir les avances payées non encore déduites pour un employé
   */
  async getUndeductedAdvances(employeeId: string): Promise<EmployeeAdvance[]> {
    return await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `AND({EmployeeId} = '${employeeId}', {Status} = 'paid')`,
      sort: [{ field: 'PaymentDate', direction: 'asc' }],
    });
  }

  /**
   * Calculer le total des avances non déduites pour un employé
   */
  async getTotalUndeducted(employeeId: string): Promise<number> {
    const advances = await this.getUndeductedAdvances(employeeId);
    return advances.reduce((sum, a) => sum + a.Amount, 0);
  }

  /**
   * Obtenir les statistiques des avances
   */
  async getStatistics(
    workspaceId: string,
    period?: { startDate: string; endDate: string }
  ): Promise<{
    totalAdvances: number;
    totalAmount: number;
    byStatus: {
      pending: number;
      approved: number;
      rejected: number;
      paid: number;
      deducted: number;
    };
    averageAmount: number;
    topRequesters: Array<{ employeeId: string; employeeName: string; totalAmount: number; count: number }>;
  }> {
    const filters: EmployeeAdvanceFilters = {};
    if (period) {
      filters.startDate = period.startDate;
      filters.endDate = period.endDate;
    }

    const advances = await this.list(workspaceId, filters);

    const totalAdvances = advances.length;
    const totalAmount = advances.reduce((sum, a) => sum + a.Amount, 0);

    // Par statut
    const byStatus = {
      pending: 0,
      approved: 0,
      rejected: 0,
      paid: 0,
      deducted: 0,
    };
    advances.forEach((a) => {
      byStatus[a.Status]++;
    });

    const averageAmount = totalAdvances > 0 ? totalAmount / totalAdvances : 0;

    // Top demandeurs
    const employeeMap: Record<string, { employeeId: string; employeeName: string; totalAmount: number; count: number }> = {};
    advances.forEach((a) => {
      if (!employeeMap[a.EmployeeId]) {
        employeeMap[a.EmployeeId] = {
          employeeId: a.EmployeeId,
          employeeName: a.EmployeeName,
          totalAmount: 0,
          count: 0,
        };
      }
      employeeMap[a.EmployeeId].totalAmount += a.Amount;
      employeeMap[a.EmployeeId].count++;
    });

    const topRequesters = Object.values(employeeMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    return {
      totalAdvances,
      totalAmount,
      byStatus,
      averageAmount,
      topRequesters,
    };
  }

  /**
   * Mettre à jour les notes d'une avance
   */
  async updateNotes(advanceId: string, notes: string): Promise<EmployeeAdvance> {
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `{AdvanceId} = '${advanceId}'`,
    });

    if (advances.length === 0) {
      throw new Error('Avance non trouvée');
    }

    return await airtableClient.update<EmployeeAdvance>('EmployeeAdvance', (advances[0] as any)._recordId, {
      Notes: notes,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Annuler une avance (seulement si pending ou approved)
   */
  async cancel(advanceId: string, reason?: string): Promise<EmployeeAdvance> {
    const advances = await airtableClient.list<EmployeeAdvance>('EmployeeAdvance', {
      filterByFormula: `{AdvanceId} = '${advanceId}'`,
    });

    if (advances.length === 0) {
      throw new Error('Avance non trouvée');
    }

    const advance = advances[0];

    if (!['pending', 'approved'].includes(advance.Status)) {
      throw new Error('Seules les avances en attente ou approuvées peuvent être annulées');
    }

    const updateData: any = {
      Status: 'rejected', // On utilise rejected pour les annulations
      UpdatedAt: new Date().toISOString(),
    };

    const cancelNote = `Annulation: ${reason || 'Aucune raison fournie'}`;
    updateData.Notes = advance.Notes ? `${advance.Notes}\n\n${cancelNote}` : cancelNote;

    return await airtableClient.update<EmployeeAdvance>('EmployeeAdvance', (advance as any)._recordId, updateData);
  }
}
