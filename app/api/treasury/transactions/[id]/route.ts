/**
 * API Routes - Transactions - Opérations par ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new TransactionService();

/**
 * GET /api/treasury/transactions/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);
    const { id } = await params;

    const transaction = await service.getById(id);

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: transaction });
  } catch (error: any) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/treasury/transactions/[id] - Annuler
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_DELETE);
    const { id } = await params;

    await service.cancel(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
