/**
 * API Routes - Demandes de Dépenses
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';
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
    if (searchParams.get('status'))     filters.status     = searchParams.get('status');
    if (searchParams.get('categoryId')) filters.categoryId = searchParams.get('categoryId');
    if (searchParams.get('search'))     filters.search     = searchParams.get('search');
    if (searchParams.get('startDate'))  filters.startDate  = searchParams.get('startDate');
    if (searchParams.get('endDate'))    filters.endDate    = searchParams.get('endDate');
    if (searchParams.get('limit'))      filters.limit      = parseInt(searchParams.get('limit')!, 10);
    if (searchParams.get('offset'))     filters.offset     = parseInt(searchParams.get('offset')!, 10);
    if (searchParams.get('requesterId')) {
      const raw = searchParams.get('requesterId');
      filters.requesterId = raw === 'me' ? await getCurrentUserId() : raw;
    }

    // Si le client demande le total (pour pagination UI), on lance les deux en parallèle.
    const wantTotal = searchParams.get('withTotal') === '1';
    if (wantTotal) {
      const [data, total] = await Promise.all([
        service.list(workspaceId, filters),
        service.count(workspaceId, filters),
      ]);
      return NextResponse.json({ data, total });
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
 *
 * Le requesterId est toujours déduit de la session (l'utilisateur courant est
 * automatiquement le demandeur — jamais usurpable depuis le body).
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const requesterId = await getCurrentUserId();
    const body = await request.json();

    const expenseRequest = await service.create({
      ...body,
      workspaceId,
      requesterId,
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
