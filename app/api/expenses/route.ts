/**
 * API Routes - Dépenses
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ExpenseService } from '@/lib/modules/expenses/expense-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseService();

/**
 * GET /api/expenses - Liste des dépenses
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
    if (searchParams.get('categoryId')) {
      filters.categoryId = searchParams.get('categoryId');
    }
    if (searchParams.get('payerId')) {
      filters.payerId = searchParams.get('payerId');
    }
    if (searchParams.get('startDate')) {
      filters.startDate = searchParams.get('startDate');
    }
    if (searchParams.get('endDate')) {
      filters.endDate = searchParams.get('endDate');
    }

    const expenses = await service.list(workspaceId, filters);

    return NextResponse.json({ data: expenses });
  } catch (error: any) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/expenses - Créer une dépense
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const expense = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
