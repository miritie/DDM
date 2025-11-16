/**
 * API Route - Ordre de production individuel
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductionOrderService } from '@/lib/modules/production/production-order-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ProductionOrderService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_VIEW);
    const { id } = await params;
    const order = await service.getById(id);

    if (!order) {
      return NextResponse.json({ error: 'Ordre de production non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const { id } = await params;
    const body = await request.json();

    const order = await service.update(id, body);
    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
