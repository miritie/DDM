import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { requireAdminRole } from '@/lib/auth/require-admin-role';
import { CustomerOrderService } from '@/lib/modules/customer-orders/customer-order-service';

const service = new CustomerOrderService();

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);
    await requireAdminRole();
    const me = await getCurrentUser();
    const { id } = await params;
    const data = await service.approve(id, (me as any).userId);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
