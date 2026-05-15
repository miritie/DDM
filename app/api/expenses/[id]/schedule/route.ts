/**
 * POST /api/expenses/[id]/schedule
 *
 * Planifie le paiement d'une dépense approuvée à une date future.
 * Body : { scheduledDate: "YYYY-MM-DD" }
 * Le payerId est déduit de la session (l'utilisateur qui planifie devient
 * le payeur ; il pourra être confirmé/écrasé au moment de l'exécution).
 *
 * Statut : approved → scheduled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseService } from '@/lib/modules/expenses/expense-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserId } from '@/lib/auth/get-session';

const service = new ExpenseService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_PAY);
    const { id } = await params;
    const body = await request.json();
    const payerId = await getCurrentUserId();

    if (!body?.scheduledDate) {
      return NextResponse.json({ error: 'scheduledDate requis' }, { status: 400 });
    }

    const expense = await service.schedule({
      expenseId: id,
      scheduledDate: body.scheduledDate,
      payerId,
    });
    return NextResponse.json({ data: expense });
  } catch (error: any) {
    console.error('Error scheduling expense:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la planification' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
