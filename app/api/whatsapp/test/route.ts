/**
 * API Route - Test WhatsApp
 * POST /api/whatsapp/test - Teste la connexion à un groupe WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { WhatsAppReportService } from '@/lib/modules/reports/whatsapp-report-service';

const whatsappService = new WhatsAppReportService();

export async function POST(request: NextRequest) {
  try {
    const { groupId } = await request.json();

    if (!groupId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Group ID requis',
        },
        { status: 400 }
      );
    }

    // Tester la connexion
    const result = await whatsappService.testConnection(groupId);

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Test réussi ! Message envoyé au groupe',
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Échec du test',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Erreur test WhatsApp:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
