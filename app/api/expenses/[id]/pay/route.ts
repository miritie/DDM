/**
 * API Route - Payer Dépense
 * Module Dépenses
 *
 * Deux modes :
 *   - Multi-wallet (préféré) : body = { allocations: [{ walletId, amount }, ...], notes? }
 *     → crée N transactions, décrémente les wallets, passe l'expense en 'paid'
 *   - Legacy : body = { paymentMethod, paymentDate? }
 *     → met juste le statut à 'paid' avec un payment_method_id (pas de mouvement wallet)
 *
 * Le payerId est toujours déduit de la session — jamais du body.
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

    if (Array.isArray(body.allocations) && body.allocations.length > 0) {
      const result = await service.payFromWallets({
        expenseId: id,
        payerId,
        paymentDate: body.paymentDate,
        allocations: body.allocations,
        notes: body.notes,
      });
      return NextResponse.json({ data: result });
    }

    const expense = await service.pay({
      expenseId: id,
      paymentDate: body.paymentDate,
      paymentMethod: body.paymentMethod,
      payerId,
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { id } = await params;
    const transactions = await service.listPaymentTransactions(id);
    return NextResponse.json({ data: transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
