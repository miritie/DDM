/**
 * Service - Gestion des Objectifs des Employés
 * Module RH & Rémunérations
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { EmployeeTarget } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import { CommissionService } from './commission-service';

const postgresClient = getPostgresClient();
const commissionService = new CommissionService();

export interface CreateEmployeeTargetInput {
  employeeId: string;
  employeeName: string;
  period: string; // YYYY-MM
  salesTarget: number;
  targetBonus: number;
  workspaceId: string;
}

export interface UpdateEmployeeTargetInput {
  salesTarget?: number;
  currentSales?: number;
  targetBonus?: number;
  bonusEarned?: number;
  bonusPaid?: boolean;
}

export interface EmployeeTargetFilters {
  employeeId?: string;
  period?: string;
  isAchieved?: boolean;
  bonusPaid?: boolean;
}

export class EmployeeTargetService {
  /**
   * Créer un nouvel objectif pour un employé
   */
  async create(input: CreateEmployeeTargetInput): Promise<EmployeeTarget> {
    // Validation: période au format YYYY-MM
    const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!periodRegex.test(input.period)) {
      throw new Error('La période doit être au format YYYY-MM');
    }

    // Validation: target et bonus positifs
    if (input.salesTarget <= 0) {
      throw new Error('L\'objectif de ventes doit être positif');
    }
    if (input.targetBonus < 0) {
      throw new Error('Le bonus doit être positif');
    }

    // Vérifier si un objectif existe déjà pour cette période
    const existing = await postgresClient.list<EmployeeTarget>('employee_targets', {
      filterByFormula: `AND(employee_id = '${input.employeeId}', period = '${input.period}')`,
    });

    if (existing.length > 0) {
      throw new Error('Un objectif existe déjà pour cet employé sur cette période');
    }

    // Calculer le début et la fin de la période
    const [year, month] = input.period.split('-');
    const periodStart = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
    const periodEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();

    const target: any = {
      TargetId: uuidv4(),
      EmployeeId: input.employeeId,
      EmployeeName: input.employeeName,
      Period: input.period,
      PeriodStart: periodStart,
      PeriodEnd: periodEnd,
      SalesTarget: input.salesTarget,
      CurrentSales: 0,
      AchievementRate: 0,
      TargetBonus: input.targetBonus,
      BonusEarned: 0,
      BonusPaid: false,
      IsAchieved: false,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<EmployeeTarget>('employee_targets', target);
    return created;
  }

  /**
   * Récupérer un objectif par son ID
   */
  async getById(targetId: string): Promise<EmployeeTarget | null> {
    const targets = await postgresClient.list<EmployeeTarget>('employee_targets', {
      filterByFormula: `target_id = '${targetId}'`,
    });
    return targets.length > 0 ? targets[0] : null;
  }

  /**
   * Récupérer l'objectif d'un employé pour une période
   */
  async getByEmployeeAndPeriod(
    employeeId: string,
    period: string
  ): Promise<EmployeeTarget | null> {
    const targets = await postgresClient.list<EmployeeTarget>('employee_targets', {
      filterByFormula: `AND(employee_id = '${employeeId}', period = '${period}')`,
    });
    return targets.length > 0 ? targets[0] : null;
  }

  /**
   * Lister les objectifs avec filtres
   */
  async list(workspaceId: string, filters: EmployeeTargetFilters = {}): Promise<EmployeeTarget[]> {
    const filterFormulas: string[] = [`workspace_id = '${workspaceId}'`];

    if (filters.employeeId) {
      filterFormulas.push(`employee_id = '${filters.employeeId}'`);
    }
    if (filters.period) {
      filterFormulas.push(`period = '${filters.period}'`);
    }
    if (filters.isAchieved !== undefined) {
      filterFormulas.push(`is_achieved = ${filters.isAchieved}`);
    }
    if (filters.bonusPaid !== undefined) {
      filterFormulas.push(`bonus_paid = ${filters.bonusPaid}`);
    }

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await postgresClient.list<EmployeeTarget>('employee_targets', {
      filterByFormula,
      sort: [{ field: 'Period', direction: 'desc' }],
    });
  }

  /**
   * Mettre à jour un objectif
   */
  async update(targetId: string, updates: UpdateEmployeeTargetInput): Promise<EmployeeTarget> {
    const targets = await postgresClient.list<EmployeeTarget>('employee_targets', {
      filterByFormula: `target_id = '${targetId}'`,
    });

    if (targets.length === 0) {
      throw new Error('Objectif non trouvé');
    }

    const target = targets[0];

    const updateData: any = {
      UpdatedAt: new Date().toISOString(),
    };

    if (updates.salesTarget !== undefined) updateData.SalesTarget = updates.salesTarget;
    if (updates.currentSales !== undefined) updateData.CurrentSales = updates.currentSales;
    if (updates.targetBonus !== undefined) updateData.TargetBonus = updates.targetBonus;
    if (updates.bonusEarned !== undefined) updateData.BonusEarned = updates.bonusEarned;
    if (updates.bonusPaid !== undefined) updateData.BonusPaid = updates.bonusPaid;

    // Recalculer le taux de réalisation si currentSales ou salesTarget changent
    const newCurrentSales = updates.currentSales ?? target.CurrentSales;
    const newSalesTarget = updates.salesTarget ?? target.SalesTarget;
    const achievementRate = newSalesTarget > 0 ? (newCurrentSales / newSalesTarget) * 100 : 0;
    updateData.AchievementRate = achievementRate;
    updateData.IsAchieved = achievementRate >= 100;

    if (!target.id) {
      throw new Error('Target ID is missing');
    }

    const updated = await postgresClient.update<EmployeeTarget>(
      'employee_targets',
      target.id,
      updateData
    );
    return updated;
  }

  /**
   * Mettre à jour les ventes actuelles d'un objectif
   */
  async updateCurrentSales(targetId: string, salesAmount: number): Promise<EmployeeTarget> {
    const target = await this.getById(targetId);
    if (!target) {
      throw new Error('Objectif non trouvé');
    }

    const newCurrentSales = target.CurrentSales + salesAmount;
    const achievementRate = target.SalesTarget > 0 ? (newCurrentSales / target.SalesTarget) * 100 : 0;
    const isAchieved = achievementRate >= 100;

    // Calculer le bonus gagné si l'objectif est atteint
    const bonusEarned = isAchieved ? target.TargetBonus : 0;

    return await this.update(targetId, {
      currentSales: newCurrentSales,
      bonusEarned,
    });
  }

  /**
   * Calculer les ventes actuelles d'un employé pour une période
   */
  async calculateCurrentSales(
    employeeId: string,
    period: string,
    workspaceId: string
  ): Promise<number> {
    const [year, month] = period.split('-');
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();

    // Récupérer les ventes de l'employé pour la période
    const sales = await postgresClient.list('sales', {
      filterByFormula: `AND(workspace_id = '${workspaceId}', seller_id = '${employeeId}', sale_date >= '${startDate}', sale_date <= '${endDate}')`,
    });

    return sales.reduce((sum: number, sale: any) => sum + (sale.total_amount || 0), 0);
  }

  /**
   * Recalculer les objectifs d'un employé pour une période
   */
  async recalculate(employeeId: string, period: string, workspaceId: string): Promise<EmployeeTarget | null> {
    const target = await this.getByEmployeeAndPeriod(employeeId, period);
    if (!target) {
      return null;
    }

    const currentSales = await this.calculateCurrentSales(employeeId, period, workspaceId);
    const achievementRate = target.SalesTarget > 0 ? (currentSales / target.SalesTarget) * 100 : 0;
    const isAchieved = achievementRate >= 100;
    const bonusEarned = isAchieved ? target.TargetBonus : 0;

    return await this.update(target.TargetId, {
      currentSales,
      bonusEarned,
    });
  }

  /**
   * Recalculer tous les objectifs pour une période
   */
  async recalculateAll(period: string, workspaceId: string): Promise<EmployeeTarget[]> {
    const targets = await this.list(workspaceId, { period });

    const updated: EmployeeTarget[] = [];
    for (const target of targets) {
      const recalculated = await this.recalculate(target.EmployeeId, period, workspaceId);
      if (recalculated) {
        updated.push(recalculated);
      }
    }

    return updated;
  }

  /**
   * Payer les bonus d'un objectif (créer une commission)
   */
  async payBonus(targetId: string, workspaceId: string): Promise<void> {
    const target = await this.getById(targetId);
    if (!target) {
      throw new Error('Objectif non trouvé');
    }

    if (!target.IsAchieved) {
      throw new Error('L\'objectif doit être atteint pour payer le bonus');
    }

    if (target.BonusPaid) {
      throw new Error('Le bonus a déjà été payé');
    }

    if (target.BonusEarned <= 0) {
      throw new Error('Aucun bonus à payer');
    }

    // Créer une commission de type target_bonus
    await commissionService.create({
      employeeId: target.EmployeeId,
      employeeName: target.EmployeeName,
      type: 'target_bonus',
      period: target.Period,
      basedOnAmount: target.SalesTarget,
      calculatedAmount: target.BonusEarned,
      referenceId: target.TargetId,
      referenceType: 'target',
      notes: `Bonus objectif atteint pour la période ${target.Period}`,
      workspaceId,
    });

    // Marquer le bonus comme payé
    await this.update(targetId, {
      bonusPaid: true,
    });
  }

  /**
   * Créer des objectifs pour tous les employés avec commission activée
   */
  async createForAllEmployees(period: string, workspaceId: string): Promise<EmployeeTarget[]> {
    // Récupérer tous les employés actifs avec commission activée
    const employees = await postgresClient.list('employees', {
      filterByFormula: `AND(workspace_id = '${workspaceId}', status = 'active', commission_enabled = true)`,
    });

    const targets: EmployeeTarget[] = [];

    for (const employee of employees) {
      const employeeData = employee as any;

      // Vérifier si l'employé a un objectif mensuel configuré
      if (!employeeData.monthly_target || employeeData.monthly_target <= 0) {
        continue;
      }

      // Vérifier si un objectif existe déjà
      const existing = await this.getByEmployeeAndPeriod(employeeData.employee_id, period);
      if (existing) {
        continue;
      }

      const target = await this.create({
        employeeId: employeeData.employee_id,
        employeeName: employeeData.full_name,
        period,
        salesTarget: employeeData.monthly_target,
        targetBonus: employeeData.target_bonus || 0,
        workspaceId,
      });

      targets.push(target);
    }

    return targets;
  }

  /**
   * Obtenir les statistiques des objectifs
   */
  async getStatistics(
    workspaceId: string,
    period?: string
  ): Promise<{
    totalTargets: number;
    achieved: number;
    notAchieved: number;
    averageAchievementRate: number;
    totalBonusesEarned: number;
    totalBonusesPaid: number;
    topPerformers: Array<{
      employeeId: string;
      employeeName: string;
      achievementRate: number;
      bonusEarned: number;
    }>;
  }> {
    const filters: EmployeeTargetFilters = {};
    if (period) filters.period = period;

    const targets = await this.list(workspaceId, filters);

    const totalTargets = targets.length;
    const achieved = targets.filter((t) => t.IsAchieved).length;
    const notAchieved = totalTargets - achieved;

    const averageAchievementRate =
      totalTargets > 0
        ? targets.reduce((sum, t) => sum + t.AchievementRate, 0) / totalTargets
        : 0;

    const totalBonusesEarned = targets.reduce((sum, t) => sum + t.BonusEarned, 0);
    const totalBonusesPaid = targets
      .filter((t) => t.BonusPaid)
      .reduce((sum, t) => sum + t.BonusEarned, 0);

    const topPerformers = targets
      .map((t) => ({
        employeeId: t.EmployeeId,
        employeeName: t.EmployeeName,
        achievementRate: t.AchievementRate,
        bonusEarned: t.BonusEarned,
      }))
      .sort((a, b) => b.achievementRate - a.achievementRate)
      .slice(0, 10);

    return {
      totalTargets,
      achieved,
      notAchieved,
      averageAchievementRate,
      totalBonusesEarned,
      totalBonusesPaid,
      topPerformers,
    };
  }

  /**
   * Supprimer un objectif
   */
  async delete(targetId: string): Promise<void> {
    const targets = await postgresClient.list<EmployeeTarget>('employee_targets', {
      filterByFormula: `target_id = '${targetId}'`,
    });

    if (targets.length === 0) {
      throw new Error('Objectif non trouvé');
    }

    const target = targets[0];

    if (target.BonusPaid) {
      throw new Error('Impossible de supprimer un objectif dont le bonus a déjà été payé');
    }

    if (!target.id) {
      throw new Error('Target ID is missing');
    }

    await postgresClient.delete('employee_targets', target.id);
  }
}
