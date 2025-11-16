/**
 * API Route - Statistiques Dashboard IA
 * GET /api/ai/dashboard/stats
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    // TODO: Récupérer vraies stats depuis Airtable
    // Pour l'instant, données simulées

    const stats = {
      totalInsights: 12,
      newInsights: 3,
      opportunitiesValue: 2450000, // F CFA
      risksCount: 2,
      forecastsGenerated: 8,
      suggestionsActive: 5,
    };

    return NextResponse.json(
      {
        success: true,
        data: stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur stats dashboard IA:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
