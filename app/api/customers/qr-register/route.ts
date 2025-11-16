/**
 * API Route - QR Code Auto-Enregistrement Client
 * POST /api/customers/qr-register
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
      firstName,
      lastName,
      email,
      city,
      receiveWhatsApp = true,
      standId,
      agentId,
      source = 'qr_self_registration',
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
      // Si le client existe déjà, on peut le mettre à jour avec les nouvelles infos
      const updates: any = {};

      if (firstName && !existingCustomer.FirstName) {
        updates.FirstName = firstName;
      }
      if (lastName && !existingCustomer.LastName) {
        updates.LastName = lastName;
      }
      if (email && !existingCustomer.Email) {
        updates.Email = email;
      }
      if (city && !existingCustomer.City) {
        updates.City = city;
      }

      // Construire le nom complet si on a de nouvelles infos
      if ((firstName || lastName) && !existingCustomer.FullName) {
        updates.FullName = `${firstName || ''} ${lastName || ''}`.trim();
      }

      if (Object.keys(updates).length > 0) {
        await customerService.update(existingCustomer.CustomerId, updates);
      }

      // Envoyer quand même le message de bienvenue si demandé
      if (receiveWhatsApp && whatsappService.isConfigured()) {
        await whatsappService.sendWelcomeMessage(
          cleanedPhone,
          updates.FullName || existingCustomer.FullName,
          500
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Informations mises à jour',
          data: {
            customer: existingCustomer,
            isNew: false,
            whatsappSent: receiveWhatsApp,
          },
        },
        { status: 200 }
      );
    }

    // Construire le nom complet
    const fullName = firstName || lastName
      ? `${firstName || ''} ${lastName || ''}`.trim()
      : `Client ${cleanedPhone.slice(-4)}`;

    // Créer le client
    const customer = await customerService.create({
      type: 'individual',
      phone: cleanedPhone,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      fullName,
      email: email || undefined,
      city: city || undefined,
      tags: standId ? [`stand_${standId}`] : undefined,
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
    if (receiveWhatsApp && whatsappService.isConfigured()) {
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

    // 2. Ajouter le bonus de bienvenue (500 points) - TOUJOURS
    try {
      await loyaltyService.earnPoints(
        customer.CustomerId,
        500,
        'Bonus de bienvenue auto-enregistrement',
        undefined,
        'manual',
        workspaceId
      );

      results.bonusAdded = true;
    } catch (error) {
      console.error('Erreur ajout bonus:', error);
      results.bonusError = error instanceof Error ? error.message : 'Erreur inconnue';
    }

    // 3. Enregistrer l'origine (stand/agent) si fournie
    if (standId || agentId) {
      try {
        // TODO: Créer un enregistrement dans une table CustomerAcquisition
        // pour tracer l'origine et éventuellement rémunérer l'agent
      } catch (error) {
        console.error('Erreur enregistrement origine:', error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Client enregistré avec succès',
        data: {
          ...results,
          isNew: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erreur enregistrement QR client:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
