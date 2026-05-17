/**
 * POST /api/expenses/requests/[id]/approve
 *   Approuve/rejette une demande. Le body envoie { decision, comments? }.
 *   L'approverId est déduit de la session courante (jamais usurpable depuis
 *   le body).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { ExpenseRequestService } from '@/lib/modules/expenses/expense-request-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new ExpenseRequestService();
const db = getPostgresClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const { id } = await params;
    const body = await request.json();
    const approverId = await getCurrentUserId();

    // Le client envoie `decision` ('approved' | 'rejected'). On accepte
    // aussi `status` pour rétrocompat.
    const status = body.status ?? body.decision;
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json(
        { error: "decision doit valoir 'approved' ou 'rejected'" },
        { status: 400 }
      );
    }

    // Séparation des pouvoirs : un demandeur ne peut pas valider sa propre
    // demande, même s'il a la permission expense:approve.
    const userR = await db.query(`SELECT id FROM users WHERE user_id = $1 OR id::text = $1 LIMIT 1`, [approverId]);
    const userUuid = userR.rows[0]?.id;
    const reqR = await db.query(
      `SELECT requester_id FROM expense_requests WHERE expense_request_id = $1 OR id::text = $1 LIMIT 1`,
      [id]
    );
    if (reqR.rowCount === 0) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    }
    if (userUuid && userUuid === reqR.rows[0].requester_id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas valider votre propre demande de dépense' },
        { status: 403 }
      );
    }

    const expenseRequest = await service.approve({
      requestId: id,
      approverId,
      status,
      comments: body.comments,
    });

    return NextResponse.json({ data: expenseRequest });
  } catch (error: any) {
    console.error('Error approving expense request:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'approbation' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
