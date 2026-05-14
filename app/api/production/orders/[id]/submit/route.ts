/**
 * POST /api/production/orders/[id]/submit
 *   Manager production soumet l'OP pour validation admin : draft → submitted.
 *   Permission : production:submit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { ProductionOrderService } from '@/lib/modules/production/production-order-service';

const service = new ProductionOrderService();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_SUBMIT);
    const { id } = await params;
    const userId = await getCurrentUserId();
    const data = await service.submit(id, userId);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
