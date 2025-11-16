/**
 * API Route - Historique des Exécutions
 * Module Rapports & Analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/modules/reports/report-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ReportService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const { id } = await params;

    const executions = await service.getExecutions(id);
    return NextResponse.json({ data: executions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
