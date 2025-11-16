/**
 * API Route - Gestion d'une Règle Spécifique
 * GET /api/rules/[id] - Détails d'une règle
 * PATCH /api/rules/[id] - Modification d'une règle
 * DELETE /api/rules/[id] - Suppression d'une règle
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngineService } from '@/lib/modules/rules/rule-engine-service';

const ruleEngineService = new RuleEngineService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ruleId = id;

    // Récupérer la règle
    const rule = await ruleEngineService.getRule(ruleId);

    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: 'Règle non trouvée',
        },
        { status: 404 }
      );
    }

    // Récupérer les statistiques (30 derniers jours)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      const stats = await ruleEngineService.getRulePerformance(
        ruleId,
        thirtyDaysAgo.toISOString(),
        now.toISOString()
      );

      return NextResponse.json(
        {
          success: true,
          data: {
            ...rule,
            stats: {
              totalExecutions: stats.TotalExecutions,
              matchRate: stats.MatchRate,
              successRate: stats.SuccessRate,
              overrideRate: stats.OverrideRate,
            },
          },
        },
        { status: 200 }
      );
    } catch {
      // Retourner la règle sans stats si erreur
      return NextResponse.json(
        {
          success: true,
          data: {
            ...rule,
            stats: {
              totalExecutions: 0,
              matchRate: 0,
              successRate: 0,
              overrideRate: 0,
            },
          },
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Erreur récupération règle:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ruleId = id;
    const userId = 'current-user'; // TODO: Récupérer depuis session

    const body = await request.json();

    // Vérifier que la règle existe
    const existingRule = await ruleEngineService.getRule(ruleId);

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: 'Règle non trouvée',
        },
        { status: 404 }
      );
    }

    // Validation des champs modifiables
    const updates: any = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Le nom ne peut pas être vide',
          },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description.trim();
    }

    if (body.conditions !== undefined) {
      if (!Array.isArray(body.conditions) || body.conditions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Au moins une condition est requise',
          },
          { status: 400 }
        );
      }
      updates.conditions = body.conditions;
    }

    if (body.recommendedAction !== undefined) {
      updates.recommendedAction = body.recommendedAction;
    }

    if (body.autoExecute !== undefined) {
      updates.autoExecute = body.autoExecute;
    }

    if (body.requiresApproval !== undefined) {
      updates.requiresApproval = body.requiresApproval;
    }

    if (body.priority !== undefined) {
      updates.priority = body.priority;
    }

    if (body.notifyOnMatch !== undefined) {
      updates.notifyOnMatch = body.notifyOnMatch;
    }

    if (body.notifyRoles !== undefined) {
      updates.notifyRoles = body.notifyRoles;
    }

    // Mettre à jour la règle
    const updatedRule = await ruleEngineService.updateRule(ruleId, updates, userId);

    return NextResponse.json(
      {
        success: true,
        data: updatedRule,
        message: 'Règle mise à jour avec succès',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur mise à jour règle:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ruleId = id;

    // Vérifier que la règle existe
    const existingRule = await ruleEngineService.getRule(ruleId);

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: 'Règle non trouvée',
        },
        { status: 404 }
      );
    }

    // Supprimer la règle
    await ruleEngineService.deleteRule(ruleId);

    return NextResponse.json(
      {
        success: true,
        message: 'Règle supprimée avec succès',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur suppression règle:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
