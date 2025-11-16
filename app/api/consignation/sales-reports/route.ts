/**
 * API Route - Rapports de ventes
 * GET /api/consignation/sales-reports - Liste
 * POST /api/consignation/sales-reports - Créer
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SalesReportService } from '@/lib/modules/consignation/sales-report-service';
import { getWorkspaceId } from '@/lib/auth/workspace';

const salesReportService = new SalesReportService();

const salesReportLineSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantitySold: z.number().min(1),
  unitPrice: z.number().min(0),
  currency: z.string().default('XOF'),
});

const createSalesReportSchema = z.object({
  partnerId: z.string(),
  partnerName: z.string(),
  depositId: z.string().optional(),
  periodStart: z.string(),
  periodEnd: z.string(),
  reportDate: z.string(),
  lines: z.array(salesReportLineSchema).min(1),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const partnerId = searchParams.get('partnerId');

    const filters: any = {};
    if (status) filters.status = status;
    if (partnerId) filters.partnerId = partnerId;

    const reports = await salesReportService.list(workspaceId, filters);

    return NextResponse.json({
      success: true,
      data: reports,
      count: reports.length,
    });
  } catch (error: any) {
    console.error('Erreur récupération rapports:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSalesReportSchema.parse(body);

    const report = await salesReportService.create({
      ...validatedData,
      workspaceId,
    });

    return NextResponse.json(
      {
        success: true,
        data: report,
        message: 'Rapport créé avec succès',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erreur création rapport:', error);

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
