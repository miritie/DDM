/**
 * API Route - Statistiques des ordres de production
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ProductionOrderService } from '@/lib/modules/production/production-order-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ProductionOrderService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    const dateRange = from && to ? { from, to } : undefined;

    const statistics = await service.getStatistics(workspaceId, dateRange);
    return NextResponse.json({ data: statistics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
