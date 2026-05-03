import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { CustomerOrderService } from '@/lib/modules/customer-orders/customer-order-service';

const service = new CustomerOrderService();

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const data = await service.getStats(workspaceId);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
