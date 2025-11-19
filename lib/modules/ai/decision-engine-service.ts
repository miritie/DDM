/**
 * Service - Moteur de Décisions et Recommandations
 * Module IA Prédictive & Aide à la Décision
 */

import { AirtableClient } from '@/lib/airtable/client';
import { DecisionRecommendation, DecisionRule, DecisionType, DecisionStatus } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

export interface RequestDecisionInput {
  decisionType: DecisionType;
  referenceId: string;
  referenceType: string;
  referenceNumber?: string;
  referenceData: Record<string, any>;
  requestedById: string;
  requestedByName: string;
  workspaceId: string;
}

export interface ApplyDecisionInput {
  recommendationId: string;
  appliedById: string;
  appliedByName: string;
  overrideAction?: 'approve' | 'reject';
  overrideReason?: string;
}

export class DecisionEngineService {
  /**
   * Demander une recommandation de décision
   */
  async requestDecision(input: RequestDecisionInput): Promise<DecisionRecommendation> {
    // Récupérer toutes les règles actives pour ce type de décision
    const rules = await airtableClient.list<DecisionRule>('DecisionRule', {
      filterByFormula: `AND({WorkspaceId} = '${input.workspaceId}', {DecisionType} = '${input.decisionType}', {IsActive} = 1)`,
      sort: [{ field: 'Priority', direction: 'desc' }],
    });

    let matchedRule: DecisionRule | null = null;

    // Évaluer les règles par ordre de priorité
    for (const rule of rules) {
      if (this.evaluateConditions(rule.Conditions, input.referenceData)) {
        matchedRule = rule;
        break;
      }
    }

    // Si aucune règle ne correspond, utiliser une recommandation par défaut
    if (!matchedRule) {
      return this.generateDefaultRecommendation(input);
    }

    // Générer la recommandation basée sur la règle
    const recommendation = await this.generateRecommendation(input, matchedRule);

    // Mettre à jour les statistiques de la règle
    await this.updateRuleStatistics(matchedRule.RuleId, 'triggered');

    // Si auto-exécution activée, appliquer la décision automatiquement
    if (matchedRule.AutoExecute && !matchedRule.RequiresApproval) {
      await this.autoExecuteDecision(recommendation, matchedRule);
    }

    return recommendation;
  }

  /**
   * Évaluer les conditions d'une règle
   */
  private evaluateConditions(
    conditions: Array<{
      field: string;
      operator: string;
      value: any;
      logicalOperator?: 'AND' | 'OR';
    }>,
    data: Record<string, any>
  ): boolean {
    if (conditions.length === 0) return true;

    let result = true;
    let currentLogic: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const fieldValue = this.getNestedValue(data, condition.field);
      const conditionResult = this.evaluateCondition(fieldValue, condition.operator, condition.value);

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

    return result;
  }

  /**
   * Évaluer une condition unique
   */
  private evaluateCondition(fieldValue: any, operator: string, conditionValue: any): boolean {
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
        return String(fieldValue).includes(String(conditionValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(conditionValue));
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
   * Obtenir une valeur imbriquée dans un objet
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Générer une recommandation basée sur une règle
   */
  private async generateRecommendation(
    input: RequestDecisionInput,
    rule: DecisionRule
  ): Promise<DecisionRecommendation> {
    // Calculer le score de confiance basé sur les conditions remplies
    const confidenceScore = this.calculateConfidenceScore(rule, input.referenceData);

    const recommendation: Partial<DecisionRecommendation> = {
      RecommendationId: uuidv4(),
      DecisionType: input.decisionType,
      ReferenceId: input.referenceId,
      ReferenceType: input.referenceType,
      ReferenceNumber: input.referenceNumber,
      ReferenceData: input.referenceData,
      RuleId: rule.RuleId,
      RuleName: rule.Name,
      RecommendedAction: rule.RecommendedAction,
      Confidence: this.getConfidenceLevel(confidenceScore),
      ConfidenceScore: confidenceScore,
      Reasoning: this.generateReasoning(rule, input.referenceData),
      FactorsConsidered: this.extractFactors(rule, input.referenceData),
      Status: 'pending',
      AutoExecuted: rule.AutoExecute && !rule.RequiresApproval,
      WasOverridden: false,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<DecisionRecommendation>(
      'DecisionRecommendation',
      recommendation
    );
    if (!created) {
      throw new Error('Failed to create decision recommendation - Airtable not configured');
    }
    return created;
  }

  /**
   * Générer une recommandation par défaut (aucune règle ne correspond)
   */
  private async generateDefaultRecommendation(
    input: RequestDecisionInput
  ): Promise<DecisionRecommendation> {
    const recommendation: Partial<DecisionRecommendation> = {
      RecommendationId: uuidv4(),
      DecisionType: input.decisionType,
      ReferenceId: input.referenceId,
      ReferenceType: input.referenceType,
      ReferenceNumber: input.referenceNumber,
      ReferenceData: input.referenceData,
      RecommendedAction: 'escalate',
      Confidence: 'low',
      ConfidenceScore: 30,
      Reasoning: 'Aucune règle applicable. Escalade recommandée pour validation manuelle.',
      FactorsConsidered: [],
      Status: 'pending',
      AutoExecuted: false,
      WasOverridden: false,
      WorkspaceId: input.workspaceId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await airtableClient.create<DecisionRecommendation>(
      'DecisionRecommendation',
      recommendation
    );
    if (!created) {
      throw new Error('Failed to create decision recommendation - Airtable not configured');
    }
    return created;
  }

  /**
   * Calculer le score de confiance
   */
  private calculateConfidenceScore(rule: DecisionRule, data: Record<string, any>): number {
    let baseScore = 70;

    // Augmenter la confiance si la règle a un bon historique
    if (rule.SuccessRate && rule.SuccessRate > 80) {
      baseScore += 15;
    }

    // Augmenter si beaucoup de conditions sont remplies
    if (rule.Conditions.length >= 3) {
      baseScore += 10;
    }

    // Diminuer si auto-exécution sans approbation
    if (rule.AutoExecute && !rule.RequiresApproval) {
      baseScore -= 5;
    }

    return Math.min(Math.max(baseScore, 0), 100);
  }

  /**
   * Obtenir le niveau de confiance textuel
   */
  private getConfidenceLevel(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (score >= 90) return 'very_high';
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 25) return 'low';
    return 'very_low';
  }

  /**
   * Générer le raisonnement de la décision
   */
  private generateReasoning(rule: DecisionRule, data: Record<string, any>): string {
    let reasoning = `Règle "${rule.Name}" appliquée. `;

    if (rule.Conditions.length > 0) {
      reasoning += `${rule.Conditions.length} condition(s) remplie(s). `;
    }

    if (rule.AutoExecute) {
      reasoning += 'Exécution automatique activée. ';
    }

    return reasoning + rule.Description;
  }

  /**
   * Extraire les facteurs considérés
   */
  private extractFactors(
    rule: DecisionRule,
    data: Record<string, any>
  ): Array<{ factor: string; value: any; weight: number; impact: 'positive' | 'negative' | 'neutral' }> {
    const factors: any[] = [];

    rule.Conditions.forEach((condition) => {
      const value = this.getNestedValue(data, condition.field);
      factors.push({
        factor: condition.field,
        value: value,
        weight: 1,
        impact: this.determineImpact(condition, value),
      });
    });

    return factors;
  }

  /**
   * Déterminer l'impact d'un facteur
   */
  private determineImpact(condition: any, value: any): 'positive' | 'negative' | 'neutral' {
    if (condition.operator.includes('greater')) return 'positive';
    if (condition.operator.includes('less')) return 'negative';
    return 'neutral';
  }

  /**
   * Auto-exécuter une décision
   */
  private async autoExecuteDecision(
    recommendation: DecisionRecommendation,
    rule: DecisionRule
  ): Promise<void> {
    // Mettre à jour le statut de la recommandation
    await airtableClient.update('DecisionRecommendation', (recommendation as any)._recordId, {
      Status: recommendation.RecommendedAction === 'approve' ? 'approved' : 'rejected',
      AppliedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });

    // Mettre à jour les statistiques de la règle
    await this.updateRuleStatistics(rule.RuleId, 'auto_executed');
  }

  /**
   * Appliquer manuellement une décision
   */
  async applyDecision(input: ApplyDecisionInput): Promise<DecisionRecommendation> {
    const recommendations = await airtableClient.list<DecisionRecommendation>('DecisionRecommendation', {
      filterByFormula: `{RecommendationId} = '${input.recommendationId}'`,
    });

    if (recommendations.length === 0) {
      throw new Error('Recommandation non trouvée');
    }

    const recommendation = recommendations[0];

    if (recommendation.Status !== 'pending') {
      throw new Error('Cette recommandation a déjà été traitée');
    }

    const finalAction = input.overrideAction || recommendation.RecommendedAction;
    const wasOverridden = input.overrideAction !== undefined;

    const updateData: any = {
      Status: finalAction === 'approve' ? 'approved' : 'rejected',
      AppliedAt: new Date().toISOString(),
      AppliedById: input.appliedById,
      AppliedByName: input.appliedByName,
      WasOverridden: wasOverridden,
      OverrideReason: input.overrideReason,
      UpdatedAt: new Date().toISOString(),
    };

    // Mettre à jour les statistiques de la règle si applicable
    if (recommendation.RuleId) {
      await this.updateRuleStatistics(
        recommendation.RuleId,
        finalAction === 'approve' ? 'approved' : 'rejected'
      );

      if (wasOverridden) {
        await this.updateRuleStatistics(recommendation.RuleId, 'overridden');
      }
    }

    const updated = await airtableClient.update<DecisionRecommendation>(
      'DecisionRecommendation',
      (recommendation as any)._recordId,
      updateData
    );
    if (!updated) {
      throw new Error('Failed to update decision recommendation - Airtable not configured');
    }
    return updated;
  }

  /**
   * Mettre à jour les statistiques d'une règle
   */
  private async updateRuleStatistics(
    ruleId: string,
    type: 'triggered' | 'auto_executed' | 'approved' | 'rejected' | 'overridden'
  ): Promise<void> {
    const rules = await airtableClient.list<DecisionRule>('DecisionRule', {
      filterByFormula: `{RuleId} = '${ruleId}'`,
    });

    if (rules.length === 0) return;

    const rule = rules[0];
    const updateData: any = {};

    switch (type) {
      case 'triggered':
        updateData.TotalTriggered = rule.TotalTriggered + 1;
        break;
      case 'auto_executed':
        updateData.TotalAutoExecuted = rule.TotalAutoExecuted + 1;
        break;
      case 'approved':
        updateData.TotalApproved = rule.TotalApproved + 1;
        break;
      case 'rejected':
        updateData.TotalRejected = rule.TotalRejected + 1;
        break;
      case 'overridden':
        updateData.TotalOverridden = rule.TotalOverridden + 1;
        break;
    }

    // Recalculer le taux de succès
    const totalDecisions = rule.TotalApproved + rule.TotalRejected;
    if (totalDecisions > 0) {
      updateData.SuccessRate = ((rule.TotalApproved + (updateData.TotalApproved || 0)) / totalDecisions) * 100;
    }

    updateData.UpdatedAt = new Date().toISOString();

    await airtableClient.update('DecisionRule', (rule as any)._recordId, updateData);
  }

  /**
   * Obtenir les recommandations en attente
   */
  async getPendingRecommendations(workspaceId: string): Promise<DecisionRecommendation[]> {
    return await airtableClient.list<DecisionRecommendation>('DecisionRecommendation', {
      filterByFormula: `AND({WorkspaceId} = '${workspaceId}', {Status} = 'pending')`,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }

  /**
   * Obtenir l'historique des décisions
   */
  async getDecisionHistory(
    workspaceId: string,
    filters: any = {}
  ): Promise<DecisionRecommendation[]> {
    const filterFormulas: string[] = [`{WorkspaceId} = '${workspaceId}'`];

    if (filters.decisionType) filterFormulas.push(`{DecisionType} = '${filters.decisionType}'`);
    if (filters.status) filterFormulas.push(`{Status} = '${filters.status}'`);
    if (filters.ruleId) filterFormulas.push(`{RuleId} = '${filters.ruleId}'`);

    const filterByFormula =
      filterFormulas.length > 1 ? `AND(${filterFormulas.join(', ')})` : filterFormulas[0];

    return await airtableClient.list<DecisionRecommendation>('DecisionRecommendation', {
      filterByFormula,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    });
  }
}
