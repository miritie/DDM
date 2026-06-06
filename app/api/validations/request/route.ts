/**
 * API Route - Créer Demande de Validation
 * POST /api/validations/request - Crée une nouvelle demande de validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationWorkflowService } from '@/lib/modules/governance/validation-workflow-service';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';

const validationService = new ValidationWorkflowService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      entityType,
      entityId,
      entityData,
      amount,
      requestReason,
      priority,
      tags,
    } = body;

    // Workspace et demandeur depuis la session — jamais depuis le body.
    const workspaceId = await getCurrentWorkspaceId();
    const requestedBy = await getCurrentUserId();

    // Validation des champs requis
    if (!entityType || !entityId || !entityData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Champs requis manquants (entityType, entityId, entityData)',
        },
        { status: 400 }
      );
    }

    // Créer la demande de validation
    const validationRequest = await validationService.createValidationRequest({
      workspaceId,
      entityType,
      entityId,
      entityData,
      requestedBy,
      amount,
      requestReason,
      priority,
      tags,
    });

    return NextResponse.json(
      {
        success: true,
        data: validationRequest,
        message:
          validationRequest.Status === 'auto_approved'
            ? 'Demande auto-approuvée'
            : 'Demande de validation créée',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erreur création demande validation:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
