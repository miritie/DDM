/**
 * API Route - Traiter Validation
 * POST /api/validations/[id]/process - Approuve ou rejette une demande de validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationWorkflowService } from '@/lib/modules/governance/validation-workflow-service';

const validationService = new ValidationWorkflowService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const {
      validatedBy,
      status,
      comment,
      geolocation,
      ipAddress,
      userAgent,
      signatureData,
    } = body;

    // Validation des champs requis
    if (!validatedBy || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Champs requis manquants (validatedBy, status)',
        },
        { status: 400 }
      );
    }

    // Valider le statut
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json(
        {
          success: false,
          error: 'Statut invalide (approved ou rejected attendu)',
        },
        { status: 400 }
      );
    }

    // Récupérer l'IP si non fournie
    const finalIpAddress =
      ipAddress ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Récupérer le User-Agent si non fourni
    const finalUserAgent = userAgent || request.headers.get('user-agent') || 'unknown';

    // Traiter la validation
    const validationRequest = await validationService.processValidation({
      validationRequestId: params.id,
      validatedBy,
      status,
      comment,
      geolocation,
      ipAddress: finalIpAddress,
      userAgent: finalUserAgent,
      signatureData,
    });

    return NextResponse.json(
      {
        success: true,
        data: validationRequest,
        message:
          status === 'approved'
            ? validationRequest.Status === 'approved'
              ? 'Demande approuvée définitivement'
              : 'Demande approuvée et escaladée au niveau supérieur'
            : 'Demande rejetée',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur traitement validation:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
