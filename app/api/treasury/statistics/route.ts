/**
 * API Route - Statistiques Trésorerie
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new TransactionService();

/**
 * GET /api/treasury/statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);

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
