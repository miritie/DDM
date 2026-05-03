/**
 * POST /api/production/orders/[id]/approve
 *   Validation d'un ordre de production par l'administrateur.
 *   draft → planned. La production peut alors démarrer l'ordre.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { ProductionOrderService } from '@/lib/modules/production/production-order-service';

const service = new ProductionOrderService();

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Validation = privilège admin (ou délégué via permission spécifique)
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const { id } = await params;
    const data = await service.approve(id);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
