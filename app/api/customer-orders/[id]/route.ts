import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { CustomerOrderService } from '@/lib/modules/customer-orders/customer-order-service';

const service = new CustomerOrderService();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id } = await params;
    const data = await service.getById(id);
    if (!data) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
