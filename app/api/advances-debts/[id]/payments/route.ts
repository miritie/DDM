/**
 * API Route - Enregistrer un paiement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AdvanceDebtService } from '@/lib/modules/advances-debts/advance-debt-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AdvanceDebtService();

/**
 * POST /api/advances-debts/[id]/payments
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_EDIT);
    const { id } = await params;

    const user = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const movement = await service.recordPayment({
      advanceDebtId: id,
      movementType: 'payment',
      amount: body.amount,
      description: body.description,
      attachmentUrl: body.attachmentUrl,
      processedById: user.userId,
      workspaceId,
    });

    return NextResponse.json({ data: movement }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'enregistrement du paiement' },
      { status: 500 }
    );
  }
}
