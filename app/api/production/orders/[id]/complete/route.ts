/**
 * API Route - Compléter un ordre de production
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductionOrderService } from '@/lib/modules/production/production-order-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ProductionOrderService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const { id } = await params;
    const order = await service.complete(id);
    return NextResponse.json({ data: order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
