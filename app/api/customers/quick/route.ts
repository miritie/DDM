/**
 * API Route - Ajout Client Ultra-Rapide
 * POST /api/customers/quick
 */

import { NextRequest, NextResponse } from 'next/server';
import { customerService } from '@/lib/modules/customers/customer-service';
import { loyaltyService } from '@/lib/modules/customers/loyalty-service';
import { whatsappService } from '@/lib/whatsapp/whatsapp-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      phone,
      fullName,
      sendWelcomeWhatsApp = true,
      giveWelcomeBonus = true,
      workspaceId = 'default', // TODO: Récupérer depuis session
    } = body;

    // Validation
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Numéro de téléphone requis' },
        { status: 400 }
      );
    }

    // Nettoyer le numéro
    const cleanedPhone = phone.replace(/\D/g, '');

    // Vérifier si le client existe déjà
    const existingCustomer = await customerService.getByPhone(cleanedPhone, workspaceId);

    if (existingCustomer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ce numéro de téléphone est déjà enregistré',
          customerId: existingCustomer.CustomerId,
        },
        { status: 409 }
      );
    }

    // Créer le client
    const customer = await customerService.create({
      type: 'individual',
      phone: cleanedPhone,
      fullName: fullName || `Client ${cleanedPhone.slice(-4)}`,
      workspaceId,
    });

    // Actions automatiques
    const results = {
      customer,
      whatsappSent: false,
      bonusAdded: false,
      whatsappError: null as string | null,
      bonusError: null as string | null,
    };

    // 1. Envoyer message WhatsApp de bienvenue
    if (sendWelcomeWhatsApp && whatsappService.isConfigured()) {
      try {
        const whatsappResult = await whatsappService.sendWelcomeMessage(
          cleanedPhone,
          fullName,
          500
        );

        if (whatsappResult.success) {
          results.whatsappSent = true;

          // Enregistrer l'envoi dans le customer
          await customerService.update(customer.CustomerId, {
            LastWhatsAppDate: new Date().toISOString(),
          } as any);
        } else {
          results.whatsappError = whatsappResult.error || 'Erreur inconnue';
        }
      } catch (error) {
        console.error('Erreur envoi WhatsApp:', error);
        results.whatsappError =
          error instanceof Error ? error.message : 'Erreur inconnue';
      }
    }

    // 2. Ajouter le bonus de bienvenue (500 points)
    if (giveWelcomeBonus) {
      try {
        await loyaltyService.earnPoints(
          customer.CustomerId,
          500,
          'Bonus de bienvenue',
          undefined,
          'manual',
          workspaceId
        );

        results.bonusAdded = true;
      } catch (error) {
        console.error('Erreur ajout bonus:', error);
        results.bonusError = error instanceof Error ? error.message : 'Erreur inconnue';
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Client créé avec succès',
        data: results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erreur création client rapide:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
