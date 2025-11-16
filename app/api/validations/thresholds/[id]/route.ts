/**
 * API Route - Gestion Seuil Spécifique
 * PUT /api/validations/thresholds/[id] - Met à jour un seuil
 * DELETE /api/validations/thresholds/[id] - Supprime un seuil
 */

import { NextRequest, NextResponse } from 'next/server';
import { ValidationThresholdService } from '@/lib/modules/governance/validation-threshold-service';

const thresholdService = new ValidationThresholdService();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const {
      level1Threshold,
      level2Threshold,
      level3Threshold,
      requireAllLevels,
      autoApproveBelow,
    } = body;

    // Au moins un champ à mettre à jour
    if (
      level1Threshold === undefined &&
      level2Threshold === undefined &&
      level3Threshold === undefined &&
      requireAllLevels === undefined &&
      autoApproveBelow === undefined
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Au moins un champ à mettre à jour requis',
        },
        { status: 400 }
      );
    }

    // Mettre à jour le seuil
    const threshold = await thresholdService.updateThreshold(params.id, {
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
        message: 'Seuil mis à jour avec succès',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur mise à jour seuil:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await thresholdService.deleteThreshold(params.id);

    return NextResponse.json(
      {
        success: true,
        message: 'Seuil supprimé avec succès',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur suppression seuil:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
