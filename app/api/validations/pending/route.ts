/**
 * API Route - Validations en Attente
 * GET /api/validations/pending - Récupère les validations en attente pour un validateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationWorkflowService, ValidationLevel } from '@/lib/modules/governance/validation-workflow-service';

const validationService = new ValidationWorkflowService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const validatorId = searchParams.get('validatorId');
    const validatorLevel = searchParams.get('validatorLevel') as ValidationLevel;

    // Validation des paramètres
    if (!workspaceId || !validatorId || !validatorLevel) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paramètres requis manquants (workspaceId, validatorId, validatorLevel)',
        },
        { status: 400 }
      );
    }

    // Valider le niveau
    const validLevels: ValidationLevel[] = ['level_1', 'level_2', 'level_3', 'level_owner'];
    if (!validLevels.includes(validatorLevel)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Niveau de validation invalide',
        },
        { status: 400 }
      );
    }

    // Récupérer les validations en attente
    const pendingValidations = await validationService.getPendingValidations(
      workspaceId,
      validatorId,
      validatorLevel
    );

    return NextResponse.json(
      {
        success: true,
        data: pendingValidations,
        count: pendingValidations.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur récupération validations en attente:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
