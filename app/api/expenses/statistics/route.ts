/**
 * API Route - Statistiques Dépenses
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ExpenseService } from '@/lib/modules/expenses/expense-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseService();

/**
 * GET /api/expenses/statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const period = searchParams.get('startDate') && searchParams.get('endDate')
      ? {
          startDate: searchParams.get('startDate')!,
          endDate: searchParams.get('endDate')!,
        }
      : undefined;

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
