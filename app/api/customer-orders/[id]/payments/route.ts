import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { CustomerOrderService } from '@/lib/modules/customer-orders/customer-order-service';

const service = new CustomerOrderService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const me = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const { id } = await params;
    const body = await request.json();
    const data = await service.recordPayment(id, {
      ...body, workspaceId, receivedById: (me as any).userId,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
