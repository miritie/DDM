/**
 * API Route - Configuration Rapports
 * GET /api/reports/config - Récupère la configuration
 * POST /api/reports/config - Sauvegarde la configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { AirtableClient } from '@/lib/airtable/client';

const airtableClient = new AirtableClient();

export async function GET(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    // Récupérer la config depuis Airtable (table ReportConfig)
    // Pour l'instant, retourner config par défaut
    const config = {
      pointFlash: {
        enabled: true,
        schedule: {
          dayOfWeek: 0, // Dimanche
          hour: 19,
          minute: 0,
        },
        whatsappGroups: [],
        includePDF: true,
        sendTextSummary: true,
      },
      dailyExpenses: {
        enabled: false,
        schedule: {
          hour: 18,
          minute: 0,
        },
        whatsappGroups: [],
        includePDF: false,
      },
      dailySales: {
        enabled: false,
        schedule: {
          hour: 20,
          minute: 0,
        },
        whatsappGroups: [],
        includePDF: false,
      },
    };

    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur récupération config:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session
    const config = await request.json();

    // Valider la config
    if (!config.pointFlash || !config.dailyExpenses || !config.dailySales) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuration invalide',
        },
        { status: 400 }
      );
    }

    // Sauvegarder dans Airtable (table ReportConfig)
    // TODO: Implémenter la sauvegarde dans Airtable

    return NextResponse.json(
      {
        success: true,
        message: 'Configuration sauvegardée avec succès',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur sauvegarde config:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
