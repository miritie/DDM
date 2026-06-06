/**
 * API Routes - Transactions - Opérations par ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
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
    const workspaceId = await getCurrentWorkspaceId();

    // Scope au workspace de session : pas de lecture cross-tenant.
    const transaction = await service.getById(id, workspaceId);

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
    const workspaceId = await getCurrentWorkspaceId();

    // Scope au workspace de session : impossible d'annuler (et donc de
    // mouvementer les soldes) d'une transaction d'un autre workspace.
    await service.cancel(id, workspaceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Erreur lors de l'annulation");
  }
}
