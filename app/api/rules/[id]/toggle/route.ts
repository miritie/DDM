/**
 * API Route - Activation/Désactivation d'une Règle
 * PATCH /api/rules/[id]/toggle - Active ou désactive une règle
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngineService } from '@/lib/modules/rules/rule-engine-service';

const ruleEngineService = new RuleEngineService();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ruleId = id;
    const userId = 'current-user'; // TODO: Récupérer depuis session

    // Vérifier que la règle existe
    const existingRule = await ruleEngineService.getRuleById(ruleId);

    if (!existingRule) {
      return NextResponse.json(
        {
          success: false,
          error: 'Règle non trouvée',
        },
        { status: 404 }
      );
    }

    // Basculer le statut
    const updatedRule = await ruleEngineService.toggleRule(ruleId, !existingRule.IsActive);

    const newStatus = updatedRule.IsActive;
    const message =
      newStatus
        ? 'Règle activée avec succès'
        : 'Règle désactivée avec succès';

    return NextResponse.json(
      {
        success: true,
        data: updatedRule,
        message,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur toggle règle:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
