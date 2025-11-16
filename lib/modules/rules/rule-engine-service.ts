/**
 * Service - Moteur de Règles Métier Avancé
 * Gestion, exécution et monitoring des règles automatisées
 */

import { AirtableClient } from '@/lib/airtable/client';
import {
  DecisionRule,
  DecisionRecommendation,
  DecisionType,
  RuleTriggerType,
  RuleConditionOperator,
} from '@/types/modules';

const airtable = new AirtableClient();

// ============================================================================
// TYPES ÉTENDUS
// ============================================================================

export interface RuleTemplate {
  TemplateId: string;
  Name: string;
  Description: string;
  Category: 'expense' | 'purchase' | 'production' | 'stock' | 'pricing' | 'credit' | 'custom';
  DecisionType: DecisionType;

  // Template de conditions
  ConditionTemplate: Array<{
    field: string;
    fieldLabel: string;
    fieldType: 'number' | 'text' | 'date' | 'boolean' | 'select';
    operator: RuleConditionOperator;
    operatorLabel: string;
    defaultValue?: any;
    options?: Array<{ value: any; label: string }>;
  }>;

  // Template d'action
  ActionTemplate: {
    action: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom';
    customFields?: Array<{
      field: string;
      fieldLabel: string;
      fieldType: 'number' | 'text' | 'select';
      required: boolean;
    }>;
  };

  IsActive: boolean;
  UsageCount: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface RuleExecution {
  ExecutionId: string;
  RuleId: string;
  RuleName: string;
  TriggerType: RuleTriggerType;

  // Contexte d'exécution
  ReferenceId: string;
  ReferenceType: string;
  ReferenceData: Record<string, any>;

  // Résultat
  ConditionsMatched: boolean;
  MatchedConditions: number;
  TotalConditions: number;
  ExecutedAction: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom' | 'none';
  AutoExecuted: boolean;

  // Performance
  ExecutionTimeMs: number;

  // Métadonnées
  ExecutedAt: string;
  WorkspaceId: string;
}

export interface RulePerformanceStats {
  RuleId: string;
  RuleName: string;

  // Compteurs
  TotalExecutions: number;
  TotalMatches: number;
  TotalAutoExecuted: number;
  TotalApproved: number;
  TotalRejected: number;
  TotalOverridden: number;

  // Taux
  MatchRate: number; // % de fois où conditions remplies
  SuccessRate: number; // % de fois où décision correcte
  OverrideRate: number; // % de fois où humain override

  // Performance
  AvgExecutionTimeMs: number;

  // Période
  PeriodStart: string;
  PeriodEnd: string;
  WorkspaceId: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class RuleEngineService {
  private airtable: AirtableClient;

  constructor() {
    this.airtable = new AirtableClient();
  }

  // ==========================================================================
  // GESTION DES RÈGLES
  // ==========================================================================

  /**
   * Créer une nouvelle règle
   */
  async createRule(input: {
    name: string;
    description: string;
    decisionType: DecisionType;
    triggerType: RuleTriggerType;
    conditions: Array<{
      field: string;
      operator: RuleConditionOperator;
      value: any;
      logicalOperator?: 'AND' | 'OR';
    }>;
    recommendedAction: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom';
    customActionData?: Record<string, any>;
    autoExecute?: boolean;
    requiresApproval?: boolean;
    approverRoles?: string[];
    priority?: number;
    thresholdAmount?: number;
    notifyOnTrigger?: boolean;
    notifyUsers?: string[];
    tags?: string[];
    notes?: string;
    workspaceId: string;
    createdById: string;
    createdByName: string;
  }): Promise<DecisionRule> {
    // Générer code de règle
    const ruleCode = await this.generateRuleCode(input.workspaceId);

    const data: Partial<DecisionRule> = {
      RuleCode: ruleCode,
      Name: input.name,
      Description: input.description,
      DecisionType: input.decisionType,
      TriggerType: input.triggerType,
      IsActive: true,
      Priority: input.priority || 100,
      Conditions: input.conditions,
      RecommendedAction: input.recommendedAction,
      CustomActionData: input.customActionData,
      AutoExecute: input.autoExecute || false,
      RequiresApproval: input.requiresApproval || false,
      ApproverRoles: input.approverRoles,
      ThresholdAmount: input.thresholdAmount,
      NotifyOnTrigger: input.notifyOnTrigger || false,
      NotifyUsers: input.notifyUsers,
      Tags: input.tags,
      Notes: input.notes,
      TotalTriggered: 0,
      TotalAutoExecuted: 0,
      TotalApproved: 0,
      TotalRejected: 0,
      TotalOverridden: 0,
      SuccessRate: 0,
      CreatedById: input.createdById,
      CreatedByName: input.createdByName,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtable.create<DecisionRule>('DecisionRule', data);
  }

  /**
   * Mettre à jour une règle
   */
  async updateRule(
    ruleId: string,
    updates: Partial<DecisionRule>
  ): Promise<DecisionRule> {
    const data = {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    };

    return await airtable.update<DecisionRule>('DecisionRule', ruleId, data);
  }

  /**
   * Activer/Désactiver une règle
   */
  async toggleRule(ruleId: string, isActive: boolean): Promise<DecisionRule> {
    return await this.updateRule(ruleId, { IsActive: isActive });
  }

  /**
   * Supprimer une règle
   */
  async deleteRule(ruleId: string): Promise<void> {
    await airtable.delete('DecisionRule', ruleId);
  }

  /**
   * Lister toutes les règles
   */
  async listRules(
    workspaceId: string,
    filters?: {
      decisionType?: DecisionType;
      isActive?: boolean;
      tags?: string[];
    }
  ): Promise<DecisionRule[]> {
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.decisionType) {
      formula += ` AND {DecisionType} = '${filters.decisionType}'`;
    }

    if (filters?.isActive !== undefined) {
      formula += ` AND {IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`;
    }

    const rules = await airtable.list<DecisionRule>('DecisionRule', { filterByFormula: formula });

    // Filtrer par tags si fourni
    if (filters?.tags && filters.tags.length > 0) {
      return rules.filter(rule =>
        rule.Tags?.some(tag => filters.tags!.includes(tag))
      );
    }

    return rules.sort((a, b) => b.Priority - a.Priority);
  }

  /**
   * Récupérer une règle par ID
   */
  async getRuleById(ruleId: string): Promise<DecisionRule | null> {
    return await airtable.get<DecisionRule>('DecisionRule', ruleId);
  }

  /**
   * Dupliquer une règle
   */
  async duplicateRule(
    ruleId: string,
    newName: string,
    userId: string,
    userName: string
  ): Promise<DecisionRule> {
    const original = await this.getRuleById(ruleId);

    if (!original) {
      throw new Error('Règle originale introuvable');
    }

    return await this.createRule({
      name: newName,
      description: original.Description + ' (Copie)',
      decisionType: original.DecisionType,
      triggerType: original.TriggerType,
      conditions: original.Conditions,
      recommendedAction: original.RecommendedAction,
      customActionData: original.CustomActionData,
      autoExecute: false, // Désactiver auto-exec pour copie
      requiresApproval: original.RequiresApproval,
      approverRoles: original.ApproverRoles,
      priority: original.Priority - 1,
      thresholdAmount: original.ThresholdAmount,
      notifyOnTrigger: original.NotifyOnTrigger,
      notifyUsers: original.NotifyUsers,
      tags: original.Tags,
      notes: original.Notes,
      workspaceId: original.WorkspaceId,
      createdById: userId,
      createdByName: userName,
    });
  }

  // ==========================================================================
  // EXÉCUTION DES RÈGLES
  // ==========================================================================

  /**
   * Exécuter toutes les règles pour un contexte donné
   */
  async executeRulesForContext(
    workspaceId: string,
    decisionType: DecisionType,
    referenceId: string,
    referenceType: string,
    referenceData: Record<string, any>
  ): Promise<{
    matchedRules: DecisionRule[];
    recommendations: DecisionRecommendation[];
    executions: RuleExecution[];
  }> {
    const startTime = performance.now();

    // 1. Récupérer règles actives pour ce type de décision
    const rules = await this.listRules(workspaceId, {
      decisionType,
      isActive: true,
    });

    const matchedRules: DecisionRule[] = [];
    const recommendations: DecisionRecommendation[] = [];
    const executions: RuleExecution[] = [];

    // 2. Évaluer chaque règle
    for (const rule of rules) {
      const execStartTime = performance.now();

      const evaluation = this.evaluateRule(rule, referenceData);

      const execution: RuleExecution = {
        ExecutionId: `EXEC-${Date.now()}-${rule.RuleId}`,
        RuleId: rule.RuleId,
        RuleName: rule.Name,
        TriggerType: rule.TriggerType,
        ReferenceId: referenceId,
        ReferenceType: referenceType,
        ReferenceData: referenceData,
        ConditionsMatched: evaluation.matched,
        MatchedConditions: evaluation.matchedCount,
        TotalConditions: rule.Conditions.length,
        ExecutedAction: evaluation.matched ? rule.RecommendedAction : 'none',
        AutoExecuted: evaluation.matched && rule.AutoExecute && !rule.RequiresApproval,
        ExecutionTimeMs: performance.now() - execStartTime,
        ExecutedAt: new Date().toISOString(),
        WorkspaceId: workspaceId,
      };

      executions.push(execution);

      // 3. Si conditions remplies, créer recommandation
      if (evaluation.matched) {
        matchedRules.push(rule);

        const recommendation = await this.createRecommendation(
          rule,
          referenceId,
          referenceType,
          referenceData,
          workspaceId
        );

        recommendations.push(recommendation);

        // 4. Auto-exécuter si configuré
        if (rule.AutoExecute && !rule.RequiresApproval) {
          await this.autoExecuteRecommendation(recommendation);
        }

        // 5. Notifier si configuré
        if (rule.NotifyOnTrigger) {
          await this.notifyRuleTriggered(rule, recommendation);
        }

        // 6. Mettre à jour stats règle
        await this.incrementRuleStat(rule.RuleId, 'TotalTriggered');

        if (rule.AutoExecute && !rule.RequiresApproval) {
          await this.incrementRuleStat(rule.RuleId, 'TotalAutoExecuted');
        }
      }

      // 7. Enregistrer exécution (optionnel, pour analytics)
      // await this.saveExecution(execution);
    }

    const totalTime = performance.now() - startTime;

    console.log(
      `Rules executed for ${decisionType}: ${rules.length} rules evaluated, ` +
      `${matchedRules.length} matched, ${recommendations.length} recommendations created ` +
      `in ${totalTime.toFixed(2)}ms`
    );

    return {
      matchedRules,
      recommendations,
      executions,
    };
  }

  /**
   * Évaluer une règle
   */
  private evaluateRule(
    rule: DecisionRule,
    data: Record<string, any>
  ): { matched: boolean; matchedCount: number } {
    if (rule.Conditions.length === 0) {
      return { matched: true, matchedCount: 0 };
    }

    let result = true;
    let currentLogic: 'AND' | 'OR' = 'AND';
    let matchedCount = 0;

    for (let i = 0; i < rule.Conditions.length; i++) {
      const condition = rule.Conditions[i];
      const fieldValue = this.getNestedValue(data, condition.field);
      const conditionResult = this.evaluateCondition(
        fieldValue,
        condition.operator,
        condition.value
      );

      if (conditionResult) {
        matchedCount++;
      }

      if (i === 0) {
        result = conditionResult;
      } else {
        if (currentLogic === 'AND') {
          result = result && conditionResult;
        } else {
          result = result || conditionResult;
        }
      }

      currentLogic = condition.logicalOperator || 'AND';
    }

    return { matched: result, matchedCount };
  }

  /**
   * Évaluer une condition
   */
  private evaluateCondition(
    fieldValue: any,
    operator: RuleConditionOperator,
    conditionValue: any
  ): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue == conditionValue;
      case 'not_equals':
        return fieldValue != conditionValue;
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      case 'greater_than_or_equal':
        return Number(fieldValue) >= Number(conditionValue);
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      case 'less_than_or_equal':
        return Number(fieldValue) <= Number(conditionValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case 'between':
        if (Array.isArray(conditionValue) && conditionValue.length === 2) {
          const num = Number(fieldValue);
          return num >= Number(conditionValue[0]) && num <= Number(conditionValue[1]);
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Récupérer valeur imbriquée dans objet
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Créer recommandation depuis règle
   */
  private async createRecommendation(
    rule: DecisionRule,
    referenceId: string,
    referenceType: string,
    referenceData: Record<string, any>,
    workspaceId: string
  ): Promise<DecisionRecommendation> {
    const data: Partial<DecisionRecommendation> = {
      DecisionType: rule.DecisionType,
      ReferenceId: referenceId,
      ReferenceType: referenceType,
      ReferenceData: referenceData,
      RuleId: rule.RuleId,
      RuleName: rule.Name,
      RecommendedAction: rule.RecommendedAction,
      Confidence: 'high', // TODO: Calculer vraie confiance
      ConfidenceScore: 85,
      Reasoning: `Règle "${rule.Name}" appliquée : ${rule.Description}`,
      FactorsConsidered: this.extractFactors(rule, referenceData),
      Status: 'pending',
      AutoExecuted: rule.AutoExecute && !rule.RequiresApproval,
      WasOverridden: false,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtable.create<DecisionRecommendation>('DecisionRecommendation', data);
  }

  /**
   * Extraire facteurs considérés
   */
  private extractFactors(
    rule: DecisionRule,
    data: Record<string, any>
  ): Array<{ factor: string; value: any; weight: number; impact: 'positive' | 'negative' | 'neutral' }> {
    return rule.Conditions.map(condition => ({
      factor: condition.field,
      value: this.getNestedValue(data, condition.field),
      weight: 1,
      impact: this.determineImpact(condition),
    }));
  }

  /**
   * Déterminer impact d'une condition
   */
  private determineImpact(condition: any): 'positive' | 'negative' | 'neutral' {
    if (['greater_than', 'greater_than_or_equal'].includes(condition.operator)) {
      return 'positive';
    }
    if (['less_than', 'less_than_or_equal'].includes(condition.operator)) {
      return 'negative';
    }
    return 'neutral';
  }

  /**
   * Auto-exécuter une recommandation
   */
  private async autoExecuteRecommendation(
    recommendation: DecisionRecommendation
  ): Promise<void> {
    await airtable.update('DecisionRecommendation', recommendation.RecommendationId, {
      Status: recommendation.RecommendedAction === 'approve' ? 'approved' : 'rejected',
      AppliedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Notifier déclenchement de règle
   */
  private async notifyRuleTriggered(
    rule: DecisionRule,
    recommendation: DecisionRecommendation
  ): Promise<void> {
    // TODO: Implémenter notifications (email, push, etc.)
    console.log(`Rule triggered: ${rule.Name} - Recommendation: ${recommendation.RecommendedAction}`);
  }

  /**
   * Incrémenter statistique de règle
   */
  private async incrementRuleStat(ruleId: string, stat: keyof DecisionRule): Promise<void> {
    const rule = await this.getRuleById(ruleId);
    if (!rule) return;

    const currentValue = (rule[stat] as number) || 0;

    await this.updateRule(ruleId, {
      [stat]: currentValue + 1,
    } as Partial<DecisionRule>);
  }

  // ==========================================================================
  // TEMPLATES DE RÈGLES
  // ==========================================================================

  /**
   * Créer template de règle
   */
  async createRuleTemplate(input: {
    name: string;
    description: string;
    category: RuleTemplate['Category'];
    decisionType: DecisionType;
    conditionTemplate: RuleTemplate['ConditionTemplate'];
    actionTemplate: RuleTemplate['ActionTemplate'];
  }): Promise<RuleTemplate> {
    const data: Partial<RuleTemplate> = {
      TemplateId: `TPL-${Date.now()}`,
      Name: input.name,
      Description: input.description,
      Category: input.category,
      DecisionType: input.decisionType,
      ConditionTemplate: input.conditionTemplate,
      ActionTemplate: input.actionTemplate,
      IsActive: true,
      UsageCount: 0,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtable.create<RuleTemplate>('RuleTemplate', data);
  }

  /**
   * Lister templates de règles
   */
  async listRuleTemplates(
    category?: RuleTemplate['Category']
  ): Promise<RuleTemplate[]> {
    let formula = '';

    if (category) {
      formula = `{Category} = '${category}'`;
    }

    const templates = await airtable.list<RuleTemplate>('RuleTemplate', { filterByFormula: formula });

    return templates.filter(t => t.IsActive);
  }

  /**
   * Créer règle depuis template
   */
  async createRuleFromTemplate(
    templateId: string,
    name: string,
    conditionValues: Record<string, any>,
    workspaceId: string,
    userId: string,
    userName: string
  ): Promise<DecisionRule> {
    const template = await airtable.get<RuleTemplate>('RuleTemplate', templateId);

    if (!template) {
      throw new Error('Template introuvable');
    }

    // Construire conditions depuis template
    const conditions = template.ConditionTemplate.map(condTemplate => ({
      field: condTemplate.field,
      operator: condTemplate.operator,
      value: conditionValues[condTemplate.field] ?? condTemplate.defaultValue,
      logicalOperator: 'AND' as const,
    }));

    // Créer règle
    const rule = await this.createRule({
      name,
      description: template.Description,
      decisionType: template.DecisionType,
      triggerType: 'automatic',
      conditions,
      recommendedAction: template.ActionTemplate.action,
      autoExecute: false,
      requiresApproval: true,
      priority: 100,
      notifyOnTrigger: false,
      tags: [template.Category],
      workspaceId,
      createdById: userId,
      createdByName: userName,
    });

    // Incrémenter usage template
    await airtable.update('RuleTemplate', templateId, {
      UsageCount: (template.UsageCount || 0) + 1,
    });

    return rule;
  }

  // ==========================================================================
  // STATISTIQUES & MONITORING
  // ==========================================================================

  /**
   * Obtenir statistiques de performance d'une règle
   */
  async getRulePerformance(
    ruleId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<RulePerformanceStats> {
    const rule = await this.getRuleById(ruleId);

    if (!rule) {
      throw new Error('Règle introuvable');
    }

    // TODO: Récupérer vraies exécutions depuis table RuleExecution

    const matchRate = rule.TotalTriggered > 0
      ? (rule.TotalTriggered / rule.TotalTriggered) * 100
      : 0;

    const overrideRate = rule.TotalTriggered > 0
      ? (rule.TotalOverridden / rule.TotalTriggered) * 100
      : 0;

    return {
      RuleId: rule.RuleId,
      RuleName: rule.Name,
      TotalExecutions: rule.TotalTriggered,
      TotalMatches: rule.TotalTriggered,
      TotalAutoExecuted: rule.TotalAutoExecuted,
      TotalApproved: rule.TotalApproved,
      TotalRejected: rule.TotalRejected,
      TotalOverridden: rule.TotalOverridden,
      MatchRate: matchRate,
      SuccessRate: rule.SuccessRate || 0,
      OverrideRate: overrideRate,
      AvgExecutionTimeMs: 5, // TODO: Calculer vraie moyenne
      PeriodStart: periodStart,
      PeriodEnd: periodEnd,
      WorkspaceId: rule.WorkspaceId,
    };
  }

  /**
   * Obtenir dashboard global des règles
   */
  async getRulesDashboard(workspaceId: string): Promise<{
    totalRules: number;
    activeRules: number;
    inactiveRules: number;
    totalExecutionsToday: number;
    totalAutoExecutedToday: number;
    topPerformingRules: Array<{ ruleId: string; ruleName: string; successRate: number }>;
    recentExecutions: RuleExecution[];
  }> {
    const rules = await this.listRules(workspaceId);

    const activeRules = rules.filter(r => r.IsActive);
    const inactiveRules = rules.filter(r => !r.IsActive);

    // TODO: Calculer vraies stats depuis table RuleExecution
    const totalExecutionsToday = rules.reduce((sum, r) => sum + (r.TotalTriggered || 0), 0);
    const totalAutoExecutedToday = rules.reduce((sum, r) => sum + (r.TotalAutoExecuted || 0), 0);

    const topPerformingRules = rules
      .filter(r => r.SuccessRate && r.SuccessRate > 0)
      .sort((a, b) => (b.SuccessRate || 0) - (a.SuccessRate || 0))
      .slice(0, 5)
      .map(r => ({
        ruleId: r.RuleId,
        ruleName: r.Name,
        successRate: r.SuccessRate || 0,
      }));

    return {
      totalRules: rules.length,
      activeRules: activeRules.length,
      inactiveRules: inactiveRules.length,
      totalExecutionsToday,
      totalAutoExecutedToday,
      topPerformingRules,
      recentExecutions: [], // TODO: Récupérer depuis table
    };
  }

  // ==========================================================================
  // UTILITAIRES
  // ==========================================================================

  /**
   * Générer code unique de règle
   */
  private async generateRuleCode(workspaceId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `RULE-${year}${month}`;

    const formula = `AND({WorkspaceId} = '${workspaceId}', FIND('${prefix}', {RuleCode}) > 0)`;
    const existing = await airtable.list<DecisionRule>('DecisionRule', { filterByFormula: formula });

    const sequence = existing.length + 1;
    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Valider structure de règle
   */
  validateRule(rule: Partial<DecisionRule>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rule.Name || rule.Name.trim().length === 0) {
      errors.push('Le nom de la règle est obligatoire');
    }

    if (!rule.DecisionType) {
      errors.push('Le type de décision est obligatoire');
    }

    if (!rule.Conditions || rule.Conditions.length === 0) {
      errors.push('Au moins une condition est requise');
    }

    if (!rule.RecommendedAction) {
      errors.push('L\'action recommandée est obligatoire');
    }

    if (rule.AutoExecute && !rule.RequiresApproval && !rule.ApproverRoles) {
      // Warn: Auto-exécution sans approbation peut être dangereux
      console.warn('Règle avec auto-exécution sans approbation ni approbateurs');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const ruleEngineService = new RuleEngineService();
