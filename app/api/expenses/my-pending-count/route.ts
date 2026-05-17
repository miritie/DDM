/**
 * GET /api/expenses/my-pending-count
 *
 * Compte les demandes de dépense du user courant qui sont "en cours"
 * (statut != draft / paid / rejected / cancelled), pour alimenter le badge
 * bandeau "N en attente" côté demandeur.
 *
 * Permission : expense:create (tout user qui peut soumettre une dépense
 * doit pouvoir suivre où en sont ses demandes).
 */

import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const userIdSlug = await getCurrentUserId();  // business code USR-…

    // Compte les demandes du user courant qui sont "en cours" — c'est-à-dire
    // dont le STATUT EFFECTIF (expense.status si l'expense existe, sinon
    // request.status) n'est pas un état final.
    //
    // L'enum expense_request_status s'arrête à 'approved' ; la suite du
    // workflow (scheduled, paid) vit dans expense.status. On joint les deux
    // tables et on COALESCE.
    const r = await db.query<any>(
      `SELECT
         COALESCE(e.status::text, er.status::text) AS status,
         COUNT(*)::int AS n
       FROM expense_requests er
       JOIN users u ON u.id = er.requester_id
       LEFT JOIN expenses e ON e.expense_request_id = er.id
       WHERE er.workspace_id = $1
         AND (u.id::text = $2 OR u.user_id = $2)
         AND COALESCE(e.status::text, er.status::text) NOT IN ('draft', 'paid', 'rejected', 'cancelled')
       GROUP BY COALESCE(e.status::text, er.status::text)`,
      [workspaceId, userIdSlug]
    );

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of r.rows) {
      byStatus[row.status] = row.n;
      total += row.n;
    }

    return NextResponse.json({ data: { total, byStatus } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
