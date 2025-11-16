/**
 * API Routes - Avances & Dettes - Liste et Création
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AdvanceDebtService } from '@/lib/modules/advances-debts/advance-debt-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AdvanceDebtService();

/**
 * GET /api/advances-debts - Liste des avances/dettes
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('type')) {
      filters.type = searchParams.get('type');
    }
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('accountId')) {
      filters.accountId = searchParams.get('accountId');
    }

    const advancesDebts = await service.list(workspaceId, filters);

    return NextResponse.json({ data: advancesDebts });
  } catch (error: any) {
    console.error('Error fetching advances/debts:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/advances-debts - Création
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_CREATE);

    const user = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const advanceDebt = await service.create({
      ...body,
      grantedById: user.userId,
      workspaceId,
    });

    return NextResponse.json({ data: advanceDebt }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating advance/debt:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
