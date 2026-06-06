/**
 * API Route - Validations en Attente
 * GET /api/validations/pending - Récupère les validations en attente pour un validateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationWorkflowService, ValidationLevel } from '@/lib/modules/governance/validation-workflow-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';

const validationService = new ValidationWorkflowService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const { searchParams } = new URL(request.url);
    // Identité et workspace depuis la session — jamais depuis la query
    // (sinon n'importe quel utilisateur pouvait lire les validations d'autrui).
    const workspaceId = await getCurrentWorkspaceId();
    const validatorId = await getCurrentUserId();
    const validatorLevel = searchParams.get('validatorLevel') as ValidationLevel;

    // Validation des paramètres
    if (!validatorLevel) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paramètre requis manquant (validatorLevel)',
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
