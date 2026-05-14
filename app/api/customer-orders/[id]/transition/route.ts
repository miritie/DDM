/**
 * POST /api/customer-orders/[id]/transition
 *   body: { action: 'submit'|'mark_produced'|'mark_transferred'|'mark_delivered'|'cancel'|'link_production', ...params }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { CustomerOrderService } from '@/lib/modules/customer-orders/customer-order-service';

const service = new CustomerOrderService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const { id } = await params;
    const body = await request.json();
    const action = body.action;

    let data;
    switch (action) {
      case 'submit':           data = await service.submit(id); break;
      case 'mark_produced':    data = await service.markProduced(id); break;
      case 'mark_transferred': data = await service.markTransferred(id); break;
      case 'mark_delivered':   data = await service.markDelivered(id); break;
      case 'cancel':           data = await service.cancel(id, body.reason); break;
      case 'link_production':
        if (!body.productionOrderId) throw new Error('productionOrderId requis');
        data = await service.linkProduction(id, body.productionOrderId);
        break;
      default:
        return NextResponse.json({ error: `Action inconnue : ${action}` }, { status: 400 });
    }
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
