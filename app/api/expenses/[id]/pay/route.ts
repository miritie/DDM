/**
 * API Route - Payer Dépense
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseService } from '@/lib/modules/expenses/expense-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseService();

/**
 * POST /api/expenses/[id]/pay - Payer une dépense
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_PAY);
    const { id } = await params;
    const body = await request.json();

    const expense = await service.pay({
      expenseId: id,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      payerId: body.payerId,
    });

    return NextResponse.json({ data: expense });
  } catch (error: any) {
    console.error('Error paying expense:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du paiement' },
      { status: 500 }
    );
  }
}
