/**
 * API Routes - Mouvements de Stock
 * Module Stocks & Mouvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { StockMovementService } from '@/lib/modules/stock/stock-movement-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new StockMovementService();

/**
 * GET /api/stock/movements - Liste des mouvements
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('type')) {
      filters.type = searchParams.get('type');
    }
    if (searchParams.get('productId')) {
      filters.productId = searchParams.get('productId');
    }
    if (searchParams.get('warehouseId')) {
      filters.warehouseId = searchParams.get('warehouseId');
    }
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('dateFrom')) {
      filters.dateFrom = searchParams.get('dateFrom');
    }
    if (searchParams.get('dateTo')) {
      filters.dateTo = searchParams.get('dateTo');
    }

    const movements = await service.list(workspaceId, filters);

    return NextResponse.json({ data: movements });
  } catch (error: any) {
    console.error('Error fetching movements:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/stock/movements - Créer un mouvement
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_CREATE);

    const user = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const movement = await service.create({
      ...body,
      processedById: user.userId,
      workspaceId,
    });

    return NextResponse.json({ data: movement }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating movement:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
