/**
 * API Route - Exécution des Règles
 * POST /api/rules/execute - Exécute les règles pour un contexte donné
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngineService } from '@/lib/modules/rules/rule-engine-service';

const ruleEngineService = new RuleEngineService();

export async function POST(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    const body = await request.json();

    // Validation
    if (!body.decisionType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le type de décision est obligatoire',
        },
        { status: 400 }
      );
    }

    if (!body.referenceId) {
      return NextResponse.json(
        {
          success: false,
          error: "L'ID de référence est obligatoire",
        },
        { status: 400 }
      );
    }

    if (!body.referenceData || typeof body.referenceData !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'Les données de référence sont obligatoires',
        },
        { status: 400 }
      );
    }

    // Exécuter les règles pour ce contexte
    const result = await ruleEngineService.executeRulesForContext(
      workspaceId,
      body.decisionType,
      body.referenceId,
      body.referenceData
    );

    // Préparer la réponse
    const response = {
      matchedRules: result.matchedRules.map((rule) => ({
        ruleId: rule.RuleId,
        name: rule.Name,
        recommendedAction: rule.RecommendedAction,
        autoExecute: rule.AutoExecute,
        priority: rule.Priority,
      })),
      recommendations: result.recommendations,
      executions: result.executions.map((exec) => ({
        ruleId: exec.RuleId,
        conditionsMatched: exec.ConditionsMatched,
        matchedConditions: exec.MatchedConditions,
        executionTimeMs: exec.ExecutionTimeMs,
      })),
      summary: {
        totalRulesEvaluated: result.executions.length,
        totalMatches: result.matchedRules.length,
        autoExecutedCount: result.matchedRules.filter((r) => r.AutoExecute).length,
        averageExecutionTime:
          result.executions.length > 0
            ? result.executions.reduce((sum, e) => sum + e.ExecutionTimeMs, 0) /
              result.executions.length
            : 0,
      },
    };

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur exécution règles:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
