/**
 * API Routes - Avances & Dettes - Opérations par ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AdvanceDebtService } from '@/lib/modules/advances-debts/advance-debt-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AdvanceDebtService();

/**
 * GET /api/advances-debts/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_VIEW);
    const { id } = await params;

    const advanceDebt = await service.getById(id);

    if (!advanceDebt) {
      return NextResponse.json(
        { error: 'Avance/Dette non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: advanceDebt });
  } catch (error: any) {
    console.error('Error fetching advance/debt:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/advances-debts/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_EDIT);
    const { id } = await params;

    const body = await request.json();
    const updated = await service.update(id, body);

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error('Error updating advance/debt:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/advances-debts/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_DELETE);
    const { id } = await params;

    await service.cancel(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling advance/debt:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
