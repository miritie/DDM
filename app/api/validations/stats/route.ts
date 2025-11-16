/**
 * API Route - Statistiques Validateur
 * GET /api/validations/stats - Récupère les statistiques d'un validateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationWorkflowService } from '@/lib/modules/governance/validation-workflow-service';

const validationService = new ValidationWorkflowService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const validatorId = searchParams.get('validatorId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validation des paramètres
    if (!workspaceId || !validatorId || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paramètres requis manquants (workspaceId, validatorId, startDate, endDate)',
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
