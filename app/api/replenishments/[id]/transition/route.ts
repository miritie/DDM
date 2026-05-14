/**
 * POST /api/replenishments/[id]/transition
 *   body: { action: 'submit' | 'approve' | 'link_production' | 'mark_produced' | 'cancel', ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { ReplenishmentService } from '@/lib/modules/replenishments/replenishment-service';

const service = new ReplenishmentService();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    const body = await req.json();
    const action = body.action;

    switch (action) {
      case 'submit':
        await requirePermission(PERMISSIONS.REPLENISHMENT_CREATE);
        return NextResponse.json({ data: await service.submit(id) });
      case 'approve':
        await requirePermission(PERMISSIONS.REPLENISHMENT_APPROVE);
        return NextResponse.json({ data: await service.approve(id, (me as any).userId) });
      case 'link_production':
        await requirePermission(PERMISSIONS.REPLENISHMENT_APPROVE);
        if (!body.productionOrderId) return NextResponse.json({ error: 'productionOrderId requis' }, { status: 400 });
        return NextResponse.json({ data: await service.linkProductionOrder(id, body.productionOrderId) });
      case 'mark_produced':
        await requirePermission(PERMISSIONS.REPLENISHMENT_APPROVE);
        return NextResponse.json({ data: await service.markProduced(id) });
      case 'cancel':
        await requirePermission(PERMISSIONS.REPLENISHMENT_APPROVE);
        return NextResponse.json({ data: await service.cancel(id, body.reason) });
      default:
        return NextResponse.json({ error: `Action inconnue : ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
