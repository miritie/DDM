/**
 * API Route - Seuils de Validation
 * GET /api/validations/thresholds - Récupère les seuils
 * POST /api/validations/thresholds - Crée un seuil
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationThresholdService } from '@/lib/modules/governance/validation-threshold-service';
import { ValidatableEntityType } from '@/lib/modules/governance/validation-workflow-service';

const thresholdService = new ValidationThresholdService();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const entityType = searchParams.get('entityType') as ValidatableEntityType | null;
    const category = searchParams.get('category');

    // Validation du workspace
    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'workspaceId requis',
        },
        { status: 400 }
      );
    }

    let thresholds;

    if (entityType && category) {
      // Récupérer un seuil spécifique
      const threshold = await thresholdService.getThreshold(workspaceId, entityType, category);
      thresholds = threshold ? [threshold] : [];
    } else if (entityType) {
      // Récupérer tous les seuils pour ce type d'entité
      thresholds = await thresholdService.getThresholdsByEntityType(workspaceId, entityType);
    } else {
      // Récupérer tous les seuils du workspace
      thresholds = await thresholdService.getAllThresholds(workspaceId);
    }

    return NextResponse.json(
      {
        success: true,
        data: thresholds,
        count: thresholds.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur récupération seuils:', error);

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
    const body = await request.json();

    const {
      workspaceId,
      entityType,
      category,
      level1Threshold,
      level2Threshold,
      level3Threshold,
      requireAllLevels,
      autoApproveBelow,
    } = body;

    // Validation des champs requis
    if (
      !workspaceId ||
      !entityType ||
      level1Threshold === undefined ||
      level2Threshold === undefined ||
      level3Threshold === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Champs requis manquants',
        },
        { status: 400 }
      );
    }

    // Créer le seuil
    const threshold = await thresholdService.createThreshold({
      workspaceId,
      entityType,
      category,
      level1Threshold,
      level2Threshold,
      level3Threshold,
      requireAllLevels,
      autoApproveBelow,
    });

    return NextResponse.json(
      {
        success: true,
        data: threshold,
        message: 'Seuil créé avec succès',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erreur création seuil:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
