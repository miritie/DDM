/**
 * API Route - Statistiques Validateur
 * GET /api/validations/stats - Récupère les statistiques d'un validateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationWorkflowService } from '@/lib/modules/governance/validation-workflow-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';

const validationService = new ValidationWorkflowService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const { searchParams } = new URL(request.url);
    // Identité et workspace depuis la session — jamais depuis la query.
    const workspaceId = await getCurrentWorkspaceId();
    const validatorId = await getCurrentUserId();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validation des paramètres
    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paramètres requis manquants (startDate, endDate)',
        },
        { status: 400 }
      );
    }

    // Récupérer les statistiques
    const stats = await validationService.getValidatorStats(
      workspaceId,
      validatorId,
      startDate,
      endDate
    );

    return NextResponse.json(
      {
        success: true,
        data: stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur récupération statistiques validateur:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
