/**
 * API Routes - Dépenses - Opérations par ID
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseService } from '@/lib/modules/expenses/expense-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseService();

/**
 * GET /api/expenses/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { id } = await params;

    const expense = await service.getById(id);

    if (!expense) {
      return NextResponse.json(
        { error: 'Dépense non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: expense });
  } catch (error: any) {
    console.error('Error fetching expense:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expenses/[id] - Annuler
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
    console.error('Error cancelling expense:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
