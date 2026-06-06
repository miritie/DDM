/**
 * API Route - Duplication d'une Règle
 * POST /api/rules/[id]/duplicate - Duplique une règle existante
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngineService } from '@/lib/modules/rules/rule-engine-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const ruleEngineService = new RuleEngineService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.AI_RULE_CREATE);
    const { id } = await params;
    const ruleId = id;
    const userId = 'current-user'; // TODO: Récupérer depuis session
    const userName = 'Current User'; // TODO: Récupérer depuis session

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

    // Dupliquer la règle
    const duplicatedRule = await ruleEngineService.duplicateRule(
      ruleId,
      `${existingRule.Name} (Copie)`,
      userId,
      userName
    );

    return NextResponse.json(
      {
        success: true,
        data: duplicatedRule,
        message: 'Règle dupliquée avec succès',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erreur duplication règle:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
