/**
 * API Routes - Demandes de Dépenses - Opérations par ID
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseRequestService } from '@/lib/modules/expenses/expense-request-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseRequestService();

/**
 * GET /api/expenses/requests/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { id } = await params;

    const expenseRequest = await service.getById(id);

    if (!expenseRequest) {
      return NextResponse.json(
        { error: 'Demande non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: expenseRequest });
  } catch (error: any) {
    console.error('Error fetching expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/expenses/requests/[id] - Mettre à jour
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_EDIT);
    const { id } = await params;
    const body = await request.json();

    const expenseRequest = await service.update(id, body);

    return NextResponse.json({ data: expenseRequest });
  } catch (error: any) {
    console.error('Error updating expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expenses/requests/[id] - Annuler
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_DELETE);
    const { id } = await params;

    await service.cancel(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
