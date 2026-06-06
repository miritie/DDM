/**
 * API Route - Traiter Validation
 * POST /api/validations/[id]/process - Approuve ou rejette une demande de validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationWorkflowService } from '@/lib/modules/governance/validation-workflow-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserId } from '@/lib/auth/get-session';

const validationService = new ValidationWorkflowService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const { id } = await params;
    const body = await request.json();

    const {
      status,
      comment,
      geolocation,
      ipAddress,
      userAgent,
      signatureData,
    } = body;

    // Identité du validateur depuis la session — jamais depuis le body
    // (sinon n'importe qui pouvait valider en se faisant passer pour autrui).
    const validatedBy = await getCurrentUserId();

    // Validation des champs requis
    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Champ requis manquant (status)',
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
      validationRequestId: id,
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
