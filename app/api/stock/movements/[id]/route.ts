/**
 * API Routes - Mouvements - Opérations par ID
 * Module Stocks & Mouvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { StockMovementService } from '@/lib/modules/stock/stock-movement-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new StockMovementService();

/**
 * GET /api/stock/movements/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const { id } = await params;

    const movement = await service.getById(id);

    if (!movement) {
      return NextResponse.json(
        { error: 'Mouvement non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: movement });
  } catch (error: any) {
    console.error('Error fetching movement:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stock/movements/[id] - Annuler
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.STOCK_DELETE);
    const { id } = await params;

    await service.cancel(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling movement:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
