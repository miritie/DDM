/**
 * API Route - Dashboard Global
 * Module Rapports & Analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { DashboardService } from '@/lib/modules/reports/dashboard-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new DashboardService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate') || new Date(new Date().setDate(1)).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const dashboard = await service.getGlobalDashboard(workspaceId, startDate, endDate);
    return NextResponse.json({ data: dashboard });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
