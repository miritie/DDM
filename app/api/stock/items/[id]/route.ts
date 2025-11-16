/**
 * API Routes - Articles en Stock - Opérations par ID
 * Module Stocks & Mouvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/modules/stock/stock-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new StockService();

/**
 * GET /api/stock/items/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const { id } = await params;

    const item = await service.getById(id);

    if (!item) {
      return NextResponse.json(
        { error: 'Article non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: item });
  } catch (error: any) {
    console.error('Error fetching stock item:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stock/items/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.STOCK_EDIT);
    const { id } = await params;
    const body = await request.json();

    const item = await service.update(id, body);

    return NextResponse.json({ data: item });
  } catch (error: any) {
    console.error('Error updating stock item:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}
