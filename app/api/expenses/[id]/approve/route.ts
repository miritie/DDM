/**
 * API Route - Approuver Dépense
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseService } from '@/lib/modules/expenses/expense-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseService();

/**
 * POST /api/expenses/[id]/approve - Approuver une dépense
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const { id } = await params;

    const expense = await service.approve(id);

    return NextResponse.json({ data: expense });
  } catch (error: any) {
    console.error('Error approving expense:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'approbation' },
      { status: 500 }
    );
  }
}
