/**
 * API Route - Statistiques Avances & Dettes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AdvanceDebtService } from '@/lib/modules/advances-debts/advance-debt-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AdvanceDebtService();

/**
 * GET /api/advances-debts/statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const statistics = await service.getStatistics(workspaceId);

    return NextResponse.json({ data: statistics });
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    );
  }
}
