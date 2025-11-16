/**
 * API Route - Règlements
 * GET /api/consignation/settlements - Liste
 * POST /api/consignation/settlements - Créer
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SettlementService } from '@/lib/modules/consignation/settlement-service';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';

const settlementService = new SettlementService();

const createSettlementSchema = z.object({
  partnerId: z.string(),
  partnerName: z.string(),
  salesReportIds: z.array(z.string()).min(1),
  totalDue: z.number().min(0),
  currency: z.string().default('XOF'),
  preparedById: z.string(),
  preparedByName: z.string(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const partnerId = searchParams.get('partnerId');

    const filters: any = {};
    if (status) filters.status = status;
    if (partnerId) filters.partnerId = partnerId;

    const settlements = await settlementService.list(workspaceId, filters);

    return NextResponse.json({
      success: true,
      data: settlements,
      count: settlements.length,
    });
  } catch (error: any) {
    console.error('Erreur récupération règlements:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSettlementSchema.parse(body);

    const settlement = await settlementService.create({
      ...validatedData,
      workspaceId,
    });

    return NextResponse.json(
      {
        success: true,
        data: settlement,
        message: 'Règlement créé avec succès',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erreur création règlement:', error);

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
