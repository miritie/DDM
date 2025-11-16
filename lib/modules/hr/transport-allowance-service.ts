/**
 * Service - Gestion des Indemnités de Transport
 * Module RH - Remboursement des frais de déplacement
 */

import { AirtableClient } from '@/lib/airtable/client';
import {
  TransportAllowance,
  TransportAllowanceRule,
  TransportAllowanceStatus,
  TransportType,
  EmployeeRole,
} from '@/types/modules';

const TABLE_TRANSPORT = 'TransportAllowance';
const TABLE_RULES = 'TransportAllowanceRule';

export class TransportAllowanceService {
  private airtable: AirtableClient;

  constructor() {
    this.airtable = new AirtableClient();
  }

  // ============================================================================
  // CRUD - Transport Allowances
  // ============================================================================

  /**
   * Lister les indemnités de transport
   */
  async list(
    workspaceId: string,
    filters?: {
      employeeId?: string;
      status?: TransportAllowanceStatus;
      dateFrom?: string;
      dateTo?: string;
      isPaid?: boolean;
    }
  ): Promise<TransportAllowance[]> {
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.employeeId) {
      formula += ` AND {EmployeeId} = '${filters.employeeId}'`;
    }
    if (filters?.status) {
      formula += ` AND {Status} = '${filters.status}'`;
    }
    if (filters?.dateFrom) {
      formula += ` AND {WorkDate} >= '${filters.dateFrom}'`;
    }
    if (filters?.dateTo) {
      formula += ` AND {WorkDate} <= '${filters.dateTo}'`;
    }
    if (filters?.isPaid !== undefined) {
      if (filters.isPaid) {
        formula += ` AND {Status} = 'paid'`;
      } else {
        formula += ` AND {Status} != 'paid'`;
      }
    }

    const records = await this.airtable.findRecords<TransportAllowance>(
      TABLE_TRANSPORT,
      formula
    );

    return records.sort(
      (a, b) => new Date(b.WorkDate).getTime() - new Date(a.WorkDate).getTime()
    );
  }

  /**
   * Récupérer une indemnité par ID
   */
  async getById(transportId: string): Promise<TransportAllowance | null> {
    return this.airtable.getRecord<TransportAllowance>(TABLE_TRANSPORT, transportId);
  }

  /**
   * Créer une indemnité de transport
   */
  async create(input: {
    employeeId: string;
    employeeName: string;
    employeeRole: EmployeeRole;
    workDate: string;
    transportType: TransportType;
    description?: string;
    locationId?: string;
    locationName?: string;
    attendanceId?: string;
    proofPhotoUrl?: string;
    distanceKm?: number;
    workspaceId: string;
  }): Promise<TransportAllowance> {
    // Générer le numéro
    const transportNumber = await this.generateTransportNumber(input.workspaceId);

    // Récupérer la règle applicable
    const rule = await this.getApplicableRule(
      input.workspaceId,
      input.employeeRole,
      input.transportType
    );

    if (!rule) {
      throw new Error('Aucune règle de transport active trouvée');
    }

    // Calculer le montant
    let appliedRate = rule.DefaultAmount;
    let amount = rule.DefaultAmount;

    // Si distance fournie et règle au km
    if (input.distanceKm && rule.RatePerKm) {
      const minDistance = rule.MinDistanceKm || 0;
      if (input.distanceKm >= minDistance) {
        amount = input.distanceKm * rule.RatePerKm;
        appliedRate = rule.RatePerKm;
      }
    }

    // Appliquer max si défini
    if (rule.MaxAmountPerDay && amount > rule.MaxAmountPerDay) {
      amount = rule.MaxAmountPerDay;
    }

    const data: Partial<TransportAllowance> = {
      TransportNumber: transportNumber,
      EmployeeId: input.employeeId,
      EmployeeName: input.employeeName,
      EmployeeRole: input.employeeRole,
      WorkDate: input.workDate,
      TransportType: input.transportType,
      Description: input.description,
      Amount: amount,
      Currency: rule.Currency,
      DefaultRate: rule.DefaultAmount,
      AppliedRate: appliedRate,
      LocationId: input.locationId,
      LocationName: input.locationName,
      AttendanceId: input.attendanceId,
      ProofPhotoUrl: input.proofPhotoUrl,
      DistanceKm: input.distanceKm,
      RatePerKm: rule.RatePerKm,
      Status: rule.RequiresApproval ? 'pending' : 'validated',
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const record = await this.airtable.createRecord<TransportAllowance>(
      TABLE_TRANSPORT,
      data
    );

    return record;
  }

  /**
   * Mettre à jour une indemnité
   */
  async update(
    transportId: string,
    updates: Partial<TransportAllowance>
  ): Promise<TransportAllowance> {
    const data = {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    };

    return this.airtable.updateRecord<TransportAllowance>(
      TABLE_TRANSPORT,
      transportId,
      data
    );
  }

  /**
   * Valider une indemnité
   */
  async validate(
    transportId: string,
    validatedById: string,
    validatedByName: string
  ): Promise<TransportAllowance> {
    const transport = await this.getById(transportId);
    if (!transport) {
      throw new Error('Indemnité introuvable');
    }

    if (transport.Status !== 'pending') {
      throw new Error('Seules les indemnités en attente peuvent être validées');
    }

    return this.update(transportId, {
      Status: 'validated',
      ValidatedById: validatedById,
      ValidatedByName: validatedByName,
      ValidatedAt: new Date().toISOString(),
    });
  }

  /**
   * Rejeter une indemnité
   */
  async reject(
    transportId: string,
    validatedById: string,
    validatedByName: string,
    reason: string
  ): Promise<TransportAllowance> {
    const transport = await this.getById(transportId);
    if (!transport) {
      throw new Error('Indemnité introuvable');
    }

    if (transport.Status !== 'pending') {
      throw new Error('Seules les indemnités en attente peuvent être rejetées');
    }

    return this.update(transportId, {
      Status: 'rejected',
      ValidatedById: validatedById,
      ValidatedByName: validatedByName,
      ValidatedAt: new Date().toISOString(),
      RejectionReason: reason,
    });
  }

  /**
   * Marquer comme payée (appelé depuis Payroll)
   */
  async markAsPaid(
    transportId: string,
    payrollId: string,
    paidDate?: string
  ): Promise<TransportAllowance> {
    const transport = await this.getById(transportId);
    if (!transport) {
      throw new Error('Indemnité introuvable');
    }

    if (transport.Status !== 'validated') {
      throw new Error('Seules les indemnités validées peuvent être payées');
    }

    return this.update(transportId, {
      Status: 'paid',
      PayrollId: payrollId,
      PaidDate: paidDate || new Date().toISOString(),
    });
  }

  /**
   * Récupérer les indemnités validées non payées pour un employé
   */
  async getValidatedUnpaidForEmployee(
    workspaceId: string,
    employeeId: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<TransportAllowance[]> {
    let formula = `AND({WorkspaceId} = '${workspaceId}', {EmployeeId} = '${employeeId}', {Status} = 'validated')`;

    if (periodStart) {
      formula = `AND(${formula}, {WorkDate} >= '${periodStart}')`;
    }
    if (periodEnd) {
      formula = `AND(${formula}, {WorkDate} <= '${periodEnd}')`;
    }

    return this.airtable.findRecords<TransportAllowance>(TABLE_TRANSPORT, formula);
  }

  /**
   * Calculer le total des indemnités pour un employé sur une période
   */
  async calculateTotalForEmployee(
    workspaceId: string,
    employeeId: string,
    periodStart: string,
    periodEnd: string,
    status: 'validated' | 'paid' = 'validated'
  ): Promise<number> {
    const transports = await this.list(workspaceId, {
      employeeId,
      dateFrom: periodStart,
      dateTo: periodEnd,
      status,
    });

    return transports.reduce((sum, t) => sum + t.Amount, 0);
  }

  // ============================================================================
  // Rules Management
  // ============================================================================

  /**
   * Lister les règles
   */
  async listRules(
    workspaceId: string,
    filters?: {
      isActive?: boolean;
    }
  ): Promise<TransportAllowanceRule[]> {
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.isActive !== undefined) {
      formula += ` AND {IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`;
    }

    return this.airtable.findRecords<TransportAllowanceRule>(TABLE_RULES, formula);
  }

  /**
   * Récupérer une règle par ID
   */
  async getRuleById(ruleId: string): Promise<TransportAllowanceRule | null> {
    return this.airtable.getRecord<TransportAllowanceRule>(TABLE_RULES, ruleId);
  }

  /**
   * Créer une règle
   */
  async createRule(input: {
    name: string;
    defaultAmount: number;
    currency: string;
    employeeRoles?: EmployeeRole[];
    transportTypes?: TransportType[];
    minDistanceKm?: number;
    ratePerKm?: number;
    maxAmountPerDay?: number;
    requiresApproval?: boolean;
    validFrom?: string;
    validUntil?: string;
    notes?: string;
    workspaceId: string;
  }): Promise<TransportAllowanceRule> {
    const data: Partial<TransportAllowanceRule> = {
      Name: input.name,
      IsActive: true,
      DefaultAmount: input.defaultAmount,
      Currency: input.currency,
      EmployeeRoles: input.employeeRoles,
      TransportTypes: input.transportTypes,
      MinDistanceKm: input.minDistanceKm,
      RatePerKm: input.ratePerKm,
      MaxAmountPerDay: input.maxAmountPerDay,
      RequiresApproval: input.requiresApproval ?? false,
      ValidFrom: input.validFrom,
      ValidUntil: input.validUntil,
      Notes: input.notes,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return this.airtable.createRecord<TransportAllowanceRule>(TABLE_RULES, data);
  }

  /**
   * Mettre à jour une règle
   */
  async updateRule(
    ruleId: string,
    updates: Partial<TransportAllowanceRule>
  ): Promise<TransportAllowanceRule> {
    const data = {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    };

    return this.airtable.updateRecord<TransportAllowanceRule>(
      TABLE_RULES,
      ruleId,
      data
    );
  }

  /**
   * Obtenir la règle applicable pour un employé et type de transport
   */
  async getApplicableRule(
    workspaceId: string,
    employeeRole: EmployeeRole,
    transportType: TransportType
  ): Promise<TransportAllowanceRule | null> {
    const rules = await this.listRules(workspaceId, { isActive: true });

    const now = new Date().toISOString();

    // Filtrer les règles applicables
    const applicableRules = rules.filter((rule) => {
      // Vérifier dates de validité
      if (rule.ValidFrom && now < rule.ValidFrom) return false;
      if (rule.ValidUntil && now > rule.ValidUntil) return false;

      // Vérifier rôle si spécifié
      if (rule.EmployeeRoles && rule.EmployeeRoles.length > 0) {
        if (!rule.EmployeeRoles.includes(employeeRole)) return false;
      }

      // Vérifier type de transport si spécifié
      if (rule.TransportTypes && rule.TransportTypes.length > 0) {
        if (!rule.TransportTypes.includes(transportType)) return false;
      }

      return true;
    });

    // Retourner la règle la plus spécifique (celle avec le plus de critères)
    if (applicableRules.length === 0) return null;

    applicableRules.sort((a, b) => {
      const scoreA =
        (a.EmployeeRoles?.length || 0) + (a.TransportTypes?.length || 0);
      const scoreB =
        (b.EmployeeRoles?.length || 0) + (b.TransportTypes?.length || 0);
      return scoreB - scoreA;
    });

    return applicableRules[0];
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Statistiques des indemnités de transport
   */
  async getStatistics(
    workspaceId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    totalTransports: number;
    pendingValidation: number;
    validated: number;
    paid: number;
    rejected: number;
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
    avgAmountPerDay: number;
    byType: Record<TransportType, { count: number; amount: number }>;
  }> {
    let filters: any = {};
    if (dateRange) {
      filters = {
        dateFrom: dateRange.start,
        dateTo: dateRange.end,
      };
    }

    const transports = await this.list(workspaceId, filters);

    const stats = {
      totalTransports: transports.length,
      pendingValidation: transports.filter((t) => t.Status === 'pending').length,
      validated: transports.filter((t) => t.Status === 'validated').length,
      paid: transports.filter((t) => t.Status === 'paid').length,
      rejected: transports.filter((t) => t.Status === 'rejected').length,
      totalAmount: transports.reduce((sum, t) => sum + t.Amount, 0),
      pendingAmount: transports
        .filter((t) => t.Status === 'pending')
        .reduce((sum, t) => sum + t.Amount, 0),
      paidAmount: transports
        .filter((t) => t.Status === 'paid')
        .reduce((sum, t) => sum + t.Amount, 0),
      avgAmountPerDay: 0,
      byType: {} as Record<TransportType, { count: number; amount: number }>,
    };

    // Moyenne par jour
    if (transports.length > 0) {
      stats.avgAmountPerDay = stats.totalAmount / transports.length;
    }

    // Par type
    const types: TransportType[] = [
      'stand_visit',
      'client_visit',
      'delivery',
      'meeting',
      'other',
    ];
    types.forEach((type) => {
      const filtered = transports.filter((t) => t.TransportType === type);
      stats.byType[type] = {
        count: filtered.length,
        amount: filtered.reduce((sum, t) => sum + t.Amount, 0),
      };
    });

    return stats;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Générer un numéro de transport
   */
  private async generateTransportNumber(workspaceId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `TRA-${year}${month}`;

    const formula = `AND({WorkspaceId} = '${workspaceId}', FIND('${prefix}', {TransportNumber}) > 0)`;
    const existing = await this.airtable.findRecords<TransportAllowance>(
      TABLE_TRANSPORT,
      formula
    );

    const sequence = existing.length + 1;
    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }
}

export const transportAllowanceService = new TransportAllowanceService();
