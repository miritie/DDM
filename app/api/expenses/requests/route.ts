/**
 * API Routes - Demandes de Dépenses
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ExpenseRequestService } from '@/lib/modules/expenses/expense-request-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseRequestService();

/**
 * GET /api/expenses/requests - Liste des demandes
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('requesterId')) {
      filters.requesterId = searchParams.get('requesterId');
    }
    if (searchParams.get('categoryId')) {
      filters.categoryId = searchParams.get('categoryId');
    }

    const requests = await service.list(workspaceId, filters);

    return NextResponse.json({ data: requests });
  } catch (error: any) {
    console.error('Error fetching expense requests:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/expenses/requests - Créer une demande
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const expenseRequest = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: expenseRequest }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
