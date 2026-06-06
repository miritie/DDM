/**
 * API Routes - Transactions - Opérations par ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError } from '@/lib/http/api-error';

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
  } catch (error) {
    return handleApiError(error, 'Erreur lors de la récupération');
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
  } catch (error) {
    return handleApiError(error, "Erreur lors de l'annulation");
  }
}
