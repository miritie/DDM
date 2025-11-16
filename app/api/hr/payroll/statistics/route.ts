/**
 * API Route - Statistiques Paie
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { PayrollService } from '@/lib/modules/hr/payroll-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new PayrollService();

/**
 * GET /api/hr/payroll/statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || undefined;

    const statistics = await service.getStatistics(workspaceId, period);

    return NextResponse.json({ data: statistics });
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    );
  }
}
