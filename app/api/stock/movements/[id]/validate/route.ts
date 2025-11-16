/**
 * API Route - Validation de Mouvement
 * Module Stocks & Mouvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { StockMovementService } from '@/lib/modules/stock/stock-movement-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new StockMovementService();

/**
 * POST /api/stock/movements/[id]/validate
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.STOCK_EDIT);
    const { id } = await params;

    const movement = await service.validate(id);

    return NextResponse.json({ data: movement });
  } catch (error: any) {
    console.error('Error validating movement:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la validation' },
      { status: 500 }
    );
  }
}
