/**
 * API Route - Approuver/Rejeter Demande de Dépense
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseRequestService } from '@/lib/modules/expenses/expense-request-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseRequestService();

/**
 * POST /api/expenses/requests/[id]/approve - Approuver/Rejeter une demande
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const { id } = await params;
    const body = await request.json();

    const expenseRequest = await service.approve({
      requestId: id,
      approverId: body.approverId,
      status: body.status,
      comments: body.comments,
    });

    return NextResponse.json({ data: expenseRequest });
  } catch (error: any) {
    console.error('Error approving expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'approbation' },
      { status: 500 }
    );
  }
}
