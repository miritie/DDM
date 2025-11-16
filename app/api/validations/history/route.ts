/**
 * API Route - Historique des Validations
 * GET /api/validations/history - Récupère l'historique des validations pour une entité
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationWorkflowService, ValidatableEntityType } from '@/lib/modules/governance/validation-workflow-service';

const validationService = new ValidationWorkflowService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType') as ValidatableEntityType;
    const entityId = searchParams.get('entityId');

    // Validation des paramètres
    if (!entityType || !entityId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paramètres requis manquants (entityType, entityId)',
        },
        { status: 400 }
      );
    }

    // Valider le type d'entité
    const validTypes: ValidatableEntityType[] = [
      'expense',
      'purchase_order',
      'production_order',
      'advance',
      'debt',
      'leave',
      'transfer',
      'price_adjustment',
      'credit_approval',
    ];

    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Type d\'entité invalide',
        },
        { status: 400 }
      );
    }

    // Récupérer l'historique
    const history = await validationService.getValidationHistory(entityType, entityId);

    return NextResponse.json(
      {
        success: true,
        data: history,
        count: history.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur récupération historique validations:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
