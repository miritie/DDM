/**
 * API Routes - Ventes
 * Module Ventes & Encaissements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { SaleService } from '@/lib/modules/sales/sale-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new SaleService();

/**
 * GET /api/sales - Liste des ventes
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('paymentStatus')) {
      filters.paymentStatus = searchParams.get('paymentStatus');
    }
    if (searchParams.get('clientId')) {
      filters.clientId = searchParams.get('clientId');
    }
    if (searchParams.get('dateFrom')) {
      filters.dateFrom = searchParams.get('dateFrom');
    }
    if (searchParams.get('dateTo')) {
      filters.dateTo = searchParams.get('dateTo');
    }

    const sales = await service.list(workspaceId, filters);

    return NextResponse.json({ data: sales });
  } catch (error: any) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/sales - Création d'une vente
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);

    const user = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    // Validate items
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un article est requis' },
        { status: 400 }
      );
    }

    const sale = await service.create({
      ...body,
      salesPersonId: user.userId,
      workspaceId,
    });

    return NextResponse.json({ data: sale }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating sale:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
