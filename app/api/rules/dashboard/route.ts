/**
 * API Route - Dashboard Statistiques Règles
 * GET /api/rules/dashboard - Statistiques globales du moteur de règles
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngineService } from '@/lib/modules/rules/rule-engine-service';

const ruleEngineService = new RuleEngineService();

export async function GET(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    // Récupérer toutes les règles
    const allRules = await ruleEngineService.listRules(workspaceId);

    // Calculer les statistiques globales
    const stats = {
      totalRules: allRules.length,
      activeRules: allRules.filter((r) => r.IsActive).length,
      inactiveRules: allRules.filter((r) => !r.IsActive).length,
      autoExecuteRules: allRules.filter((r) => r.AutoExecute).length,

      // Statistiques par type de décision
      byDecisionType: {
        expense_approval: allRules.filter((r) => r.DecisionType === 'expense_approval').length,
        purchase_order: allRules.filter((r) => r.DecisionType === 'purchase_order').length,
        production_order: allRules.filter((r) => r.DecisionType === 'production_order').length,
        stock_replenishment: allRules.filter((r) => r.DecisionType === 'stock_replenishment').length,
        price_adjustment: allRules.filter((r) => r.DecisionType === 'price_adjustment').length,
        credit_approval: allRules.filter((r) => r.DecisionType === 'credit_approval').length,
      },

      // Statistiques sur les actions recommandées
      byRecommendedAction: {
        approve: allRules.filter((r) => r.RecommendedAction === 'approve').length,
        reject: allRules.filter((r) => r.RecommendedAction === 'reject').length,
        escalate: allRules.filter((r) => r.RecommendedAction === 'escalate').length,
      },
    };

    // Récupérer les statistiques de performance agrégées (30 derniers jours)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalExecutions = 0;
    let totalMatches = 0;
    let totalSuccesses = 0;
    let totalOverrides = 0;

    const performancePromises = allRules.map(async (rule) => {
      try {
        const perf = await ruleEngineService.getRulePerformance(
          rule.RuleId,
          thirtyDaysAgo.toISOString(),
          now.toISOString()
        );

        totalExecutions += perf.TotalExecutions;
        totalMatches += Math.round(perf.TotalExecutions * (perf.MatchRate / 100));
        totalSuccesses += Math.round(perf.TotalExecutions * (perf.SuccessRate / 100));
        totalOverrides += Math.round(perf.TotalExecutions * (perf.OverrideRate / 100));
      } catch {
        // Ignorer les erreurs pour des règles individuelles
      }
    });

    await Promise.all(performancePromises);

    // Calculer les taux globaux
    const globalPerformance = {
      totalExecutions,
      matchRate: totalExecutions > 0 ? (totalMatches / totalExecutions) * 100 : 0,
      successRate: totalExecutions > 0 ? (totalSuccesses / totalExecutions) * 100 : 0,
      overrideRate: totalExecutions > 0 ? (totalOverrides / totalExecutions) * 100 : 0,
    };

    // Top 5 règles les plus utilisées
    const rulesWithExecutions = await Promise.all(
      allRules.map(async (rule) => {
        try {
          const perf = await ruleEngineService.getRulePerformance(
            rule.RuleId,
            thirtyDaysAgo.toISOString(),
            now.toISOString()
          );

          return {
            ruleId: rule.RuleId,
            name: rule.Name,
            executions: perf.TotalExecutions,
            matchRate: perf.MatchRate,
          };
        } catch {
          return {
            ruleId: rule.RuleId,
            name: rule.Name,
            executions: 0,
            matchRate: 0,
          };
        }
      })
    );

    const topRules = rulesWithExecutions
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 5);

    return NextResponse.json(
      {
        success: true,
        data: {
          summary: stats,
          performance: globalPerformance,
          topRules,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur dashboard règles:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
