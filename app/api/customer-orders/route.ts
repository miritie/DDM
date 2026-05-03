/**
 * GET  /api/customer-orders         — liste filtrable (status, clientId)
 * POST /api/customer-orders         — création (Manager Commercial)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { CustomerOrderService } from '@/lib/modules/customer-orders/customer-order-service';

const service = new CustomerOrderService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const data = await service.list(workspaceId, {
      status: (searchParams.get('status') as any) || undefined,
      clientId: searchParams.get('clientId') || undefined,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const me = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    const data = await service.create({
      ...body, workspaceId, requestedById: (me as any).userId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
