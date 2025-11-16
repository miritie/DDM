/**
 * API Route - Liste et création des dépôts
 * GET /api/consignation/deposits - Liste des dépôts
 * POST /api/consignation/deposits - Créer un dépôt
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DepositService } from '@/lib/modules/consignation/deposit-service';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';

const depositService = new DepositService();

// Schéma ligne de dépôt
const depositLineSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantityDeposited: z.number().min(1, 'La quantité doit être supérieure à 0'),
  unitPrice: z.number().min(0),
  currency: z.string().default('XOF'),
});

// Schéma création dépôt
const createDepositSchema = z.object({
  partnerId: z.string(),
  partnerName: z.string(),
  warehouseId: z.string(),
  lines: z.array(depositLineSchema).min(1, 'Au moins une ligne est requise'),
  depositDate: z.string(),
  expectedReturnDate: z.string().optional(),
  preparedById: z.string(),
  preparedByName: z.string(),
  notes: z.string().optional(),
});

/**
 * GET - Liste des dépôts avec filtres
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const partnerId = searchParams.get('partnerId');
    const warehouseId = searchParams.get('warehouseId');

    const filters: any = {};
    if (status) filters.status = status;
    if (partnerId) filters.partnerId = partnerId;
    if (warehouseId) filters.warehouseId = warehouseId;

    const deposits = await depositService.list(workspaceId, filters);

    return NextResponse.json({
      success: true,
      data: deposits,
      count: deposits.length,
    });
  } catch (error: any) {
    console.error('Erreur récupération dépôts:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST - Créer un nouveau dépôt
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();

    // Validation
    const validatedData = createDepositSchema.parse(body);

    // Créer le dépôt
    const deposit = await depositService.create({
      ...validatedData,
      workspaceId,
    });

    return NextResponse.json(
      {
        success: true,
        data: deposit,
        message: 'Dépôt créé avec succès',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erreur création dépôt:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
