/**
 * Service - Moteur de Regles Metier Avance
 * Gestion, execution et monitoring des regles automatisees
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import {
  DecisionRule,
  DecisionRecommendation,
  DecisionType,
  RuleTriggerType,
  RuleConditionOperator,
} from '@/types/modules';

const postgresClient = getPostgresClient();

// ============================================================================
// TYPES ETENDUS
// ============================================================================

export interface RuleTemplate {
  id: string;
  template_id: string;
  name: string;
  description: string;
  category: 'expense' | 'purchase' | 'production' | 'stock' | 'pricing' | 'credit' | 'custom';
  decision_type: DecisionType;

  // Template de conditions
  condition_template: Array<{
    field: string;
    fieldLabel: string;
    fieldType: 'number' | 'text' | 'date' | 'boolean' | 'select';
    operator: RuleConditionOperator;
    operatorLabel: string;
    defaultValue?: any;
    options?: Array<{ value: any; label: string }>;
  }>;

  // Template d'action
  action_template: {
    action: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom';
    customFields?: Array<{
      field: string;
      fieldLabel: string;
      fieldType: 'number' | 'text' | 'select';
      required: boolean;
    }>;
  };

  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface RuleExecution {
  execution_id: string;
  rule_id: string;
  rule_name: string;
  trigger_type: RuleTriggerType;

  // Contexte d'execution
  reference_id: string;
  reference_type: string;
  reference_data: Record<string, any>;

  // Resultat
  conditions_matched: boolean;
  matched_conditions: number;
  total_conditions: number;
  executed_action: 'approve' | 'reject' | 'escalate' | 'defer' | 'custom' | 'none';
  auto_executed: boolean;

  // Performance
  execution_time_ms: number;

  // Metadonnees
  executed_at: string;
  workspace_id: string;
}

export interface RulePerformanceStats {
  rule_id: string;
  rule_name: string;

  // Compteurs
  total_executions: number;
  total_matches: number;
  total_auto_executed: number;
  total_approved: number;
  total_rejected: number;
  total_overridden: number;

  // Taux
  match_rate: number; // % de fois ou conditions remplies
  success_rate: number; // % de fois ou decision correcte
  override_rate: number; // % de fois ou humain override

  // Performance
  avg_execution_time_ms: number;

  // Periode
  period_start: string;
  period_end: string;
  workspace_id: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class RuleEngineService {
  // ==========================================================================
  // GESTION DES REGLES
  // ==========================================================================

  /**
   * Creer une nouvelle regle
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
    // Generer code de regle
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

    const created = await postgresClient.create<DecisionRule>('decision_rules', data);
    return created;
  }

  /**
   * Mettre a jour une regle
   */
  async updateRule(
    ruleId: string,
    updates: Partial<DecisionRule>
  ): Promise<DecisionRule> {
    const data = {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    };

    const updated = await postgresClient.update<DecisionRule>('decision_rules', ruleId, data);
    return updated;
  }

  /**
   * Activer/Desactiver une regle
   */
  async toggleRule(ruleId: string, isActive: boolean): Promise<DecisionRule> {
    return await this.updateRule(ruleId, { IsActive: isActive });
  }

  /**
   * Supprimer une regle
   */
  async deleteRule(ruleId: string): Promise<void> {
    await postgresClient.delete('decision_rules', ruleId);
  }

  /**
   * Lister toutes les regles
   */
  async listRules(
    workspaceId: string,
    filters?: {
      decisionType?: DecisionType;
      isActive?: boolean;
      tags?: string[];
    }
  ): Promise<DecisionRule[]> {
    let formula = `workspace_id = '${workspaceId}'`;

    if (filters?.decisionType) {
      formula += ` AND decision_type = '${filters.decisionType}'`;
    }

    if (filters?.isActive !== undefined) {
      formula += ` AND is_active = ${filters.isActive}`;
    }

    const rules = await postgresClient.list<DecisionRule>('decision_rules', { filterByFormula: formula });

    // Filtrer par tags si fourni
    if (filters?.tags && filters.tags.length > 0) {
      return rules.filter(rule =>
        rule.Tags?.some((tag: string) => filters.tags!.includes(tag))
      );
    }

    return rules.sort((a, b) => b.Priority - a.Priority);
  }

  /**
   * Recuperer une regle par ID
   */
  async getRuleById(ruleId: string): Promise<DecisionRule | null> {
    return await postgresClient.get<DecisionRule>('decision_rules', ruleId);
  }

  /**
   * Dupliquer une regle
   */
  async duplicateRule(
    ruleId: string,
    newName: string,
    userId: string,
    userName: string
  ): Promise<DecisionRule> {
    const original = await this.getRuleById(ruleId);

    if (!original) {
      throw new Error('Regle originale introuvable');
    }

    return await this.createRule({
      name: newName,
      description: original.Description + ' (Copie)',
      decisionType: original.DecisionType,
      triggerType: original.TriggerType,
      conditions: original.Conditions,
      recommendedAction: original.RecommendedAction,
      customActionData: original.CustomActionData,
      autoExecute: false, // Desactiver auto-exec pour copie
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
  // EXECUTION DES REGLES
  // ==========================================================================

  /**
   * Executer toutes les regles pour un contexte donne
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

    // 1. Recuperer regles actives pour ce type de decision
    const rules = await this.listRules(workspaceId, {
      decisionType,
      isActive: true,
    });

    const matchedRules: DecisionRule[] = [];
    const recommendations: DecisionRecommendation[] = [];
    const executions: RuleExecution[] = [];

    // 2. Evaluer chaque regle
    for (const rule of rules) {
      const execStartTime = performance.now();

      const evaluation = this.evaluateRule(rule, referenceData);

      const execution: RuleExecution = {
        execution_id: `EXEC-${Date.now()}-${rule.RuleId}`,
        rule_id: rule.RuleId,
        rule_name: rule.Name,
        trigger_type: rule.TriggerType,
        reference_id: referenceId,
        reference_type: referenceType,
        reference_data: referenceData,
        conditions_matched: evaluation.matched,
        matched_conditions: evaluation.matchedCount,
        total_conditions: rule.Conditions.length,
        executed_action: evaluation.matched ? rule.RecommendedAction : 'none',
        auto_executed: evaluation.matched && rule.AutoExecute && !rule.RequiresApproval,
        execution_time_ms: performance.now() - execStartTime,
        executed_at: new Date().toISOString(),
        workspace_id: workspaceId,
      };

      executions.push(execution);

      // 3. Si conditions remplies, creer recommandation
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

        // 4. Auto-executer si configure
        if (rule.AutoExecute && !rule.RequiresApproval) {
          await this.autoExecuteRecommendation(recommendation);
        }

        // 5. Notifier si configure
        if (rule.NotifyOnTrigger) {
          await this.notifyRuleTriggered(rule, recommendation);
        }

        // 6. Mettre a jour stats regle
        await this.incrementRuleStat(rule.RuleId, 'TotalTriggered');

        if (rule.AutoExecute && !rule.RequiresApproval) {
          await this.incrementRuleStat(rule.RuleId, 'TotalAutoExecuted');
        }
      }

      // 7. Enregistrer execution (optionnel, pour analytics)
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
   * Evaluer une regle
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
   * Evaluer une condition
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
   * Recuperer valeur imbriquee dans objet
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Creer recommandation depuis regle
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
      Reasoning: `Regle "${rule.Name}" appliquee : ${rule.Description}`,
      FactorsConsidered: this.extractFactors(rule, referenceData),
      Status: 'pending',
      AutoExecuted: rule.AutoExecute && !rule.RequiresApproval,
      WasOverridden: false,
      WorkspaceId: workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<DecisionRecommendation>('decision_recommendations', data);
    return created;
  }

  /**
   * Extraire facteurs consideres
   */
  private extractFactors(
    rule: DecisionRule,
    data: Record<string, any>
  ): Array<{ factor: string; value: any; weight: number; impact: 'positive' | 'negative' | 'neutral' }> {
    return rule.Conditions.map((condition: any) => ({
      factor: condition.field,
      value: this.getNestedValue(data, condition.field),
      weight: 1,
      impact: this.determineImpact(condition),
    }));
  }

  /**
   * Determiner impact d'une condition
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
   * Auto-executer une recommandation
   */
  private async autoExecuteRecommendation(
    recommendation: DecisionRecommendation
  ): Promise<void> {
    if (!recommendation.id) return;

    await postgresClient.update('decision_recommendations', recommendation.id, {
      Status: recommendation.RecommendedAction === 'approve' ? 'approved' : 'rejected',
      AppliedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Notifier declenchement de regle
   */
  private async notifyRuleTriggered(
    rule: DecisionRule,
    recommendation: DecisionRecommendation
  ): Promise<void> {
    // TODO: Implementer notifications (email, push, etc.)
    console.log(`Rule triggered: ${rule.Name} - Recommendation: ${recommendation.RecommendedAction}`);
  }

  /**
   * Incrementer statistique de regle
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
  // TEMPLATES DE REGLES
  // ==========================================================================

  /**
   * Creer template de regle
   */
  async createRuleTemplate(input: {
    name: string;
    description: string;
    category: RuleTemplate['category'];
    decisionType: DecisionType;
    conditionTemplate: RuleTemplate['condition_template'];
    actionTemplate: RuleTemplate['action_template'];
  }): Promise<RuleTemplate> {
    const data: Partial<RuleTemplate> = {
      template_id: `TPL-${Date.now()}`,
      name: input.name,
      description: input.description,
      category: input.category,
      decision_type: input.decisionType,
      condition_template: input.conditionTemplate,
      action_template: input.actionTemplate,
      is_active: true,
      usage_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const created = await postgresClient.create<RuleTemplate>('rule_templates', data);
    return created;
  }

  /**
   * Lister templates de regles
   */
  async listRuleTemplates(
    category?: RuleTemplate['category']
  ): Promise<RuleTemplate[]> {
    let formula = '';

    if (category) {
      formula = `category = '${category}'`;
    }

    const templates = await postgresClient.list<RuleTemplate>('rule_templates', { filterByFormula: formula });

    return templates.filter(t => t.is_active);
  }

  /**
   * Creer regle depuis template
   */
  async createRuleFromTemplate(
    templateId: string,
    name: string,
    conditionValues: Record<string, any>,
    workspaceId: string,
    userId: string,
    userName: string
  ): Promise<DecisionRule> {
    const template = await postgresClient.get<RuleTemplate>('rule_templates', templateId);

    if (!template) {
      throw new Error('Template introuvable');
    }

    // Construire conditions depuis template
    const conditions = template.condition_template.map(condTemplate => ({
      field: condTemplate.field,
      operator: condTemplate.operator,
      value: conditionValues[condTemplate.field] ?? condTemplate.defaultValue,
      logicalOperator: 'AND' as const,
    }));

    // Creer regle
    const rule = await this.createRule({
      name,
      description: template.description,
      decisionType: template.decision_type,
      triggerType: 'automatic',
      conditions,
      recommendedAction: template.action_template.action,
      autoExecute: false,
      requiresApproval: true,
      priority: 100,
      notifyOnTrigger: false,
      tags: [template.category],
      workspaceId,
      createdById: userId,
      createdByName: userName,
    });

    // Incrementer usage template
    await postgresClient.update('rule_templates', templateId, {
      usage_count: (template.usage_count || 0) + 1,
    });

    return rule;
  }

  // ==========================================================================
  // STATISTIQUES & MONITORING
  // ==========================================================================

  /**
   * Obtenir statistiques de performance d'une regle
   */
  async getRulePerformance(
    ruleId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<RulePerformanceStats> {
    const rule = await this.getRuleById(ruleId);

    if (!rule) {
      throw new Error('Regle introuvable');
    }

    // TODO: Recuperer vraies executions depuis table RuleExecution

    const matchRate = rule.TotalTriggered > 0
      ? (rule.TotalTriggered / rule.TotalTriggered) * 100
      : 0;

    const overrideRate = rule.TotalTriggered > 0
      ? (rule.TotalOverridden / rule.TotalTriggered) * 100
      : 0;

    return {
      rule_id: rule.RuleId,
      rule_name: rule.Name,
      total_executions: rule.TotalTriggered,
      total_matches: rule.TotalTriggered,
      total_auto_executed: rule.TotalAutoExecuted,
      total_approved: rule.TotalApproved,
      total_rejected: rule.TotalRejected,
      total_overridden: rule.TotalOverridden,
      match_rate: matchRate,
      success_rate: rule.SuccessRate || 0,
      override_rate: overrideRate,
      avg_execution_time_ms: 5, // TODO: Calculer vraie moyenne
      period_start: periodStart,
      period_end: periodEnd,
      workspace_id: rule.WorkspaceId,
    };
  }

  /**
   * Obtenir dashboard global des regles
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
      recentExecutions: [], // TODO: Recuperer depuis table
    };
  }

  // ==========================================================================
  // UTILITAIRES
  // ==========================================================================

  /**
   * Generer code unique de regle
   */
  private async generateRuleCode(workspaceId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `RULE-${year}${month}`;

    const formula = `workspace_id = '${workspaceId}' AND rule_code LIKE '${prefix}%'`;
    const existing = await postgresClient.list<DecisionRule>('decision_rules', { filterByFormula: formula });

    const sequence = existing.length + 1;
    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Valider structure de regle
   */
  validateRule(rule: Partial<DecisionRule>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!rule.Name || rule.Name.trim().length === 0) {
      errors.push('Le nom de la regle est obligatoire');
    }

    if (!rule.DecisionType) {
      errors.push('Le type de decision est obligatoire');
    }

    if (!rule.Conditions || rule.Conditions.length === 0) {
      errors.push('Au moins une condition est requise');
    }

    if (!rule.RecommendedAction) {
      errors.push('L\'action recommandee est obligatoire');
    }

    if (rule.AutoExecute && !rule.RequiresApproval && !rule.ApproverRoles) {
      // Warn: Auto-execution sans approbation peut etre dangereux
      console.warn('Regle avec auto-execution sans approbation ni approbateurs');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const ruleEngineService = new RuleEngineService();
