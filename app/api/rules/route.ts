/**
 * API Route - Gestion des Règles
 * GET /api/rules - Liste des règles avec filtres
 * POST /api/rules - Création d'une nouvelle règle
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngineService } from '@/lib/modules/rules/rule-engine-service';

const ruleEngineService = new RuleEngineService();

export async function GET(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    // Récupérer les paramètres de filtre
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as 'active' | 'inactive' | null;
    const decisionType = searchParams.get('decisionType');
    const autoExecute = searchParams.get('autoExecute');

    // Récupérer toutes les règles du workspace
    let rules = await ruleEngineService.listRules(workspaceId);

    // Appliquer les filtres
    if (status) {
      const isActive = status === 'active';
      rules = rules.filter((rule) => rule.IsActive === isActive);
    }

    if (decisionType) {
      rules = rules.filter((rule) => rule.DecisionType === decisionType);
    }

    if (autoExecute !== null) {
      const autoExecBool = autoExecute === 'true';
      rules = rules.filter((rule) => rule.AutoExecute === autoExecBool);
    }

    // Récupérer les statistiques pour chaque règle
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const rulesWithStats = await Promise.all(
      rules.map(async (rule) => {
        try {
          const stats = await ruleEngineService.getRulePerformance(
            rule.RuleId,
            thirtyDaysAgo.toISOString(),
            now.toISOString()
          );

          return {
            ...rule,
            stats: {
              totalExecutions: stats.TotalExecutions,
              matchRate: stats.MatchRate,
              successRate: stats.SuccessRate,
              overrideRate: stats.OverrideRate,
            },
          };
        } catch {
          // En cas d'erreur lors de la récupération des stats, retourner la règle sans stats
          return {
            ...rule,
            stats: {
              totalExecutions: 0,
              matchRate: 0,
              successRate: 0,
              overrideRate: 0,
            },
          };
        }
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: rulesWithStats,
        count: rulesWithStats.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur récupération règles:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session
    const userId = 'current-user'; // TODO: Récupérer depuis session

    const body = await request.json();

    // Validation des champs obligatoires
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le nom de la règle est obligatoire',
        },
        { status: 400 }
      );
    }

    if (!body.decisionType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le type de décision est obligatoire',
        },
        { status: 400 }
      );
    }

    if (!body.conditions || !Array.isArray(body.conditions) || body.conditions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Au moins une condition est requise',
        },
        { status: 400 }
      );
    }

    if (!body.recommendedAction || !body.recommendedAction.action) {
      return NextResponse.json(
        {
          success: false,
          error: "L'action recommandée est obligatoire",
        },
        { status: 400 }
      );
    }

    // Créer la règle
    const newRule = await ruleEngineService.createRule({
      name: body.name.trim(),
      description: body.description?.trim() || '',
      decisionType: body.decisionType,
      triggerType: body.triggerType || 'automatic',
      conditions: body.conditions,
      recommendedAction: body.recommendedAction?.action || body.recommendedAction,
      customActionData: body.recommendedAction?.customData,
      autoExecute: body.autoExecute || false,
      requiresApproval: body.requiresApproval || false,
      approverRoles: body.approverRoles,
      priority: body.priority || 100,
      thresholdAmount: body.thresholdAmount,
      notifyOnTrigger: body.notifyOnMatch || false,
      notifyUsers: body.notifyRoles || [],
      tags: body.tags,
      notes: body.notes,
      workspaceId,
      createdById: userId,
      createdByName: 'Current User', // TODO: Get from session
    });

    return NextResponse.json(
      {
        success: true,
        data: newRule,
        message: 'Règle créée avec succès',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erreur création règle:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
