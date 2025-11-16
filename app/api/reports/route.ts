/**
 * API Route - Rapports
 * Module Rapports & Analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ReportService } from '@/lib/modules/reports/report-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ReportService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const reportType = searchParams.get('reportType') || undefined;
    const isActive = searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined;

    const reports = await service.list(workspaceId, { reportType, isActive });
    return NextResponse.json({ data: reports });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const report = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
