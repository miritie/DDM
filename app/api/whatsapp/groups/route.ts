/**
 * API Route - Groupes WhatsApp
 * GET /api/whatsapp/groups - Liste les groupes
 * POST /api/whatsapp/groups - Sauvegarde les groupes
 */

import { NextRequest, NextResponse } from 'next/server';
import { AirtableClient } from '@/lib/airtable/client';

const airtableClient = new AirtableClient();

export async function GET(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    // Récupérer les groupes depuis Airtable (table WhatsAppGroup)
    // Pour l'instant, retourner liste vide
    const groups: any[] = [];

    return NextResponse.json(
      {
        success: true,
        data: groups,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur récupération groupes:', error);

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
    const { groups } = await request.json();

    if (!Array.isArray(groups)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Format invalide',
        },
        { status: 400 }
      );
    }

    // Sauvegarder dans Airtable (table WhatsAppGroup)
    // TODO: Implémenter la sauvegarde

    return NextResponse.json(
      {
        success: true,
        message: 'Groupes sauvegardés avec succès',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur sauvegarde groupes:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
