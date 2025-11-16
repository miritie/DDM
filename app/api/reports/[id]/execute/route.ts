/**
 * API Route - Exécuter un Rapport
 * Module Rapports & Analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/lib/modules/reports/report-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUser } from '@/lib/auth/get-session';

const service = new ReportService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const { id } = await params;
    const user = await getCurrentUser();

    const execution = await service.execute(id, user.userId);
    return NextResponse.json({ data: execution }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
