/**
 * API Route - Ordres de Production
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ProductionOrderService } from '@/lib/modules/production/production-order-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { ProductionOrderStatus } from '@/types/modules';

const service = new ProductionOrderService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') as ProductionOrderStatus | undefined;
    const priority = searchParams.get('priority') as 'low' | 'normal' | 'high' | 'urgent' | undefined;
    const assignedToId = searchParams.get('assignedToId') || undefined;
    const productId = searchParams.get('productId') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const orders = await service.list(workspaceId, {
      status,
      priority,
      assignedToId,
      productId,
      fromDate,
      toDate,
    });

    return NextResponse.json({ data: orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const order = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
