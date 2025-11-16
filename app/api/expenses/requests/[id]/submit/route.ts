/**
 * API Route - Soumettre Demande de Dépense
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseRequestService } from '@/lib/modules/expenses/expense-request-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseRequestService();

/**
 * POST /api/expenses/requests/[id]/submit - Soumettre une demande
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CREATE);
    const { id } = await params;

    const expenseRequest = await service.submit(id);

    return NextResponse.json({ data: expenseRequest });
  } catch (error: any) {
    console.error('Error submitting expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la soumission' },
      { status: 500 }
    );
  }
}
