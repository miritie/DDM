/**
 * API Routes - Articles en Stock
 * Module Stocks & Mouvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { StockService } from '@/lib/modules/stock/stock-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new StockService();

/**
 * GET /api/stock/items - Liste des articles en stock
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('warehouseId')) {
      filters.warehouseId = searchParams.get('warehouseId');
    }
    if (searchParams.get('productId')) {
      filters.productId = searchParams.get('productId');
    }
    if (searchParams.get('lowStock') === 'true') {
      filters.lowStock = true;
    }
    if (searchParams.get('outOfStock') === 'true') {
      filters.outOfStock = true;
    }

    const items = await service.list(workspaceId, filters);

    return NextResponse.json({ data: items });
  } catch (error: any) {
    console.error('Error fetching stock items:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/stock/items - Créer ou mettre à jour un article en stock
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const item = await service.upsertStockItem({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock item:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
