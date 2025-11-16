/**
 * API Route - Statistiques Utilisation Seuils
 * GET /api/validations/thresholds/stats - Récupère les stats d'utilisation des seuils
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationThresholdService } from '@/lib/modules/governance/validation-threshold-service';

const thresholdService = new ValidationThresholdService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!workspaceId || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paramètres requis manquants (workspaceId, startDate, endDate)',
        },
        { status: 400 }
      );
    }

    // Récupérer les statistiques
    const stats = await thresholdService.getThresholdUsageStats(
      workspaceId,
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
    console.error('Erreur récupération stats seuils:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
