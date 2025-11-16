/**
 * API Route - Génération Point Flash
 * POST /api/reports/point-flash/generate - Génère et envoie le Point Flash
 */

import { NextRequest, NextResponse } from 'next/server';
import { PointFlashService } from '@/lib/modules/reports/point-flash-service';

const pointFlashService = new PointFlashService();

export async function POST(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    // Récupérer la configuration (TODO: depuis Airtable)
    const config = {
      enabled: true,
      schedule: {
        dayOfWeek: 0, // Dimanche
        hour: 19,
        minute: 0,
      },
      whatsappGroups: ['120363...@g.us'], // TODO: Récupérer depuis config
      includePDF: true,
      sendTextSummary: true,
    };

    // Générer et envoyer le Point Flash
    const result = await pointFlashService.generateAndSendPointFlash(workspaceId, config);

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Point Flash généré et envoyé avec succès',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur génération Point Flash:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
