/**
 * API Routes - Demandes de Dépenses - Opérations par ID
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { ExpenseRequestService } from '@/lib/modules/expenses/expense-request-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new ExpenseRequestService();
const db = getPostgresClient();

/**
 * GET /api/expenses/requests/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { id } = await params;

    const expenseRequest = await service.getById(id);

    if (!expenseRequest) {
      return NextResponse.json(
        { error: 'Demande non trouvée' },
        { status: 404 }
      );
    }

    // Flag isRequester côté serveur (séparation des pouvoirs : un demandeur
    // ne doit jamais voir les boutons Approuver/Rejeter sur sa propre demande).
    const userSlug = await getCurrentUserId();
    const uR = await db.query(`SELECT id FROM users WHERE user_id = $1 OR id::text = $1 LIMIT 1`, [userSlug]);
    const userUuid = uR.rows[0]?.id;
    const isRequester = userUuid && userUuid === expenseRequest.RequesterId;

    return NextResponse.json({ data: { ...expenseRequest, isRequester } });
  } catch (error: any) {
    console.error('Error fetching expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/expenses/requests/[id] - Mettre à jour
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_EDIT);
    const { id } = await params;
    const body = await request.json();

    const expenseRequest = await service.update(id, body);

    return NextResponse.json({ data: expenseRequest });
  } catch (error: any) {
    console.error('Error updating expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expenses/requests/[id] - Annuler
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_DELETE);
    const { id } = await params;

    await service.cancel(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
