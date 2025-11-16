/**
 * API Route - Validation Cohérence Seuils
 * GET /api/validations/thresholds/validate - Valide la cohérence de tous les seuils d'un workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationThresholdService } from '@/lib/modules/governance/validation-threshold-service';

const thresholdService = new ValidationThresholdService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'workspaceId requis',
        },
        { status: 400 }
      );
    }

    // Valider tous les seuils du workspace
    const result = await thresholdService.validateWorkspaceThresholds(workspaceId);

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: result.valid
          ? 'Tous les seuils sont valides'
          : `${result.errors.length} erreur(s) trouvée(s)`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur validation seuils:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
