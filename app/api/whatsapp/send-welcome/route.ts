/**
 * API Route - Envoyer Message WhatsApp de Bienvenue
 * POST /api/whatsapp/send-welcome
 */

import { NextRequest, NextResponse } from 'next/server';
import { whatsappService } from '@/lib/whatsapp/whatsapp-service';
import { customerService } from '@/lib/modules/customers/customer-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      phone,
      customerName,
      customerId,
      bonusPoints = 500,
      workspaceId = 'default',
    } = body;

    // Validation
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Numéro de téléphone requis' },
        { status: 400 }
      );
    }

    // Vérifier que WhatsApp est configuré
    if (!whatsappService.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'WhatsApp API non configuré. Vérifiez vos variables d\'environnement.',
        },
        { status: 503 }
      );
    }

    // Envoyer le message
    const result = await whatsappService.sendWelcomeMessage(
      phone,
      customerName,
      bonusPoints
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Erreur lors de l\'envoi du message',
        },
        { status: 500 }
      );
    }

    // Si on a un customerId, enregistrer l'envoi
    if (customerId) {
      try {
        await customerService.update(customerId, {
          LastWhatsAppDate: new Date().toISOString(),
        } as any);
      } catch (error) {
        console.error('Erreur mise à jour date WhatsApp:', error);
        // Non bloquant
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Message WhatsApp envoyé avec succès',
        data: {
          messageId: result.messageId,
          phone,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur envoi WhatsApp:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
