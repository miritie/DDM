/**
 * Service - Gestion des Indemnités de Transport
 * Module RH - Remboursement des frais de déplacement
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import {
  TransportAllowance,
  TransportAllowanceRule,
  TransportAllowanceStatus,
  TransportType,
  EmployeeRole,
} from '@/types/modules';

const TABLE_TRANSPORT = 'transport_allowances';
const TABLE_RULES = 'transport_allowance_rules';

export class TransportAllowanceService {
  private postgresClient = getPostgresClient();

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
    let formula = `workspace_id = '${workspaceId}'`;

    if (filters?.employeeId) {
      formula += ` AND employee_id = '${filters.employeeId}'`;
    }
    if (filters?.status) {
      formula += ` AND status = '${filters.status}'`;
    }
    if (filters?.dateFrom) {
      formula += ` AND work_date >= '${filters.dateFrom}'`;
    }
    if (filters?.dateTo) {
      formula += ` AND work_date <= '${filters.dateTo}'`;
    }
    if (filters?.isPaid !== undefined) {
      if (filters.isPaid) {
        formula += ` AND status = 'paid'`;
      } else {
        formula += ` AND status != 'paid'`;
      }
    }

    const records = await this.postgresClient.list<TransportAllowance>(
      TABLE_TRANSPORT,
      { filterByFormula: formula }
    );

    return records.sort(
      (a, b) => new Date(b.WorkDate).getTime() - new Date(a.WorkDate).getTime()
    );
  }

  /**
   * Récupérer une indemnité par ID
   */
  async getById(transportId: string): Promise<TransportAllowance | null> {
    return this.postgresClient.get<TransportAllowance>(TABLE_TRANSPORT, transportId);
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

    const data: any = {
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

    const record = await this.postgresClient.create<TransportAllowance>(
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
    const data: any = {
      updated_at: new Date().toISOString(),
    };

    // Convert PascalCase to snake_case for updates
    if (updates.Status !== undefined) data.status = updates.Status;
    if (updates.ValidatedById !== undefined) data.validated_by_id = updates.ValidatedById;
    if (updates.ValidatedByName !== undefined) data.validated_by_name = updates.ValidatedByName;
    if (updates.ValidatedAt !== undefined) data.validated_at = updates.ValidatedAt;
    if (updates.RejectionReason !== undefined) data.rejection_reason = updates.RejectionReason;
    if (updates.PayrollId !== undefined) data.payroll_id = updates.PayrollId;
    if (updates.PaidDate !== undefined) data.paid_date = updates.PaidDate;

    const updated = await this.postgresClient.update<TransportAllowance>(
      TABLE_TRANSPORT,
      transportId,
      data
    );

    return updated;
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

    // validatedById = business code (USR-…), FK UUID en BDD → résolution.
    const validatedByUuid = await this.resolveUserUuid(validatedById);

    return this.update(transportId, {
      Status: 'validated',
      ValidatedById: validatedByUuid,
      ValidatedByName: validatedByName,
      ValidatedAt: new Date().toISOString(),
    });
  }

  /** Accepte UUID PK ou business code user_id et retourne l'UUID PK. */
  private async resolveUserUuid(idOrSlug: string): Promise<string> {
    const r = await this.postgresClient.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [idOrSlug]
    );
    if (r.rows.length === 0) throw new Error('Utilisateur introuvable');
    return r.rows[0].id;
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

    const validatedByUuid = await this.resolveUserUuid(validatedById);

    return this.update(transportId, {
      Status: 'rejected',
      ValidatedById: validatedByUuid,
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
    let formula = `AND(workspace_id = '${workspaceId}', employee_id = '${employeeId}', status = 'validated')`;

    if (periodStart) {
      formula = `AND(${formula}, work_date >= '${periodStart}')`;
    }
    if (periodEnd) {
      formula = `AND(${formula}, work_date <= '${periodEnd}')`;
    }

    return this.postgresClient.list<TransportAllowance>(TABLE_TRANSPORT, { filterByFormula: formula });
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
    let formula = `workspace_id = '${workspaceId}'`;

    if (filters?.isActive !== undefined) {
      formula += ` AND is_active = ${filters.isActive}`;
    }

    return this.postgresClient.list<TransportAllowanceRule>(TABLE_RULES, { filterByFormula: formula });
  }

  /**
   * Récupérer une règle par ID
   */
  async getRuleById(ruleId: string): Promise<TransportAllowanceRule | null> {
    return this.postgresClient.get<TransportAllowanceRule>(TABLE_RULES, ruleId);
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
    const data: any = {
      name: input.name,
      is_active: true,
      default_amount: input.defaultAmount,
      currency: input.currency,
      employee_roles: input.employeeRoles,
      transport_types: input.transportTypes,
      min_distance_km: input.minDistanceKm,
      rate_per_km: input.ratePerKm,
      max_amount_per_day: input.maxAmountPerDay,
      requires_approval: input.requiresApproval ?? false,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      notes: input.notes,
      workspace_id: input.workspaceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = await this.postgresClient.create<TransportAllowanceRule>(TABLE_RULES, data);
    return created;
  }

  /**
   * Mettre à jour une règle
   */
  async updateRule(
    ruleId: string,
    updates: Partial<TransportAllowanceRule>
  ): Promise<TransportAllowanceRule> {
    const data: any = {
      updated_at: new Date().toISOString(),
    };

    // Convert PascalCase to snake_case for updates
    if (updates.Name !== undefined) data.name = updates.Name;
    if (updates.IsActive !== undefined) data.is_active = updates.IsActive;
    if (updates.DefaultAmount !== undefined) data.default_amount = updates.DefaultAmount;
    if (updates.Currency !== undefined) data.currency = updates.Currency;
    if (updates.EmployeeRoles !== undefined) data.employee_roles = updates.EmployeeRoles;
    if (updates.TransportTypes !== undefined) data.transport_types = updates.TransportTypes;
    if (updates.MinDistanceKm !== undefined) data.min_distance_km = updates.MinDistanceKm;
    if (updates.RatePerKm !== undefined) data.rate_per_km = updates.RatePerKm;
    if (updates.MaxAmountPerDay !== undefined) data.max_amount_per_day = updates.MaxAmountPerDay;
    if (updates.RequiresApproval !== undefined) data.requires_approval = updates.RequiresApproval;
    if (updates.ValidFrom !== undefined) data.valid_from = updates.ValidFrom;
    if (updates.ValidUntil !== undefined) data.valid_until = updates.ValidUntil;
    if (updates.Notes !== undefined) data.notes = updates.Notes;

    const updated = await this.postgresClient.update<TransportAllowanceRule>(
      TABLE_RULES,
      ruleId,
      data
    );
    return updated;
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

    const formula = `AND(workspace_id = '${workspaceId}', transport_number LIKE '${prefix}%')`;
    const existing = await this.postgresClient.list<TransportAllowance>(
      TABLE_TRANSPORT,
      { filterByFormula: formula }
    );

    const sequence = existing.length + 1;
    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }
}

export const transportAllowanceService = new TransportAllowanceService();
