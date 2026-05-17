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

    // Compte les requests submitted/approved/scheduled qui appartiennent au
    // user courant. On résout le slug → UUID dans la requête (LEFT JOIN
    // évite un round-trip supplémentaire).
    const r = await db.query<any>(
      `SELECT
         er.status,
         COUNT(*)::int AS n
       FROM expense_requests er
       JOIN users u ON u.id = er.requester_id
       WHERE er.workspace_id = $1
         AND (u.id::text = $2 OR u.user_id = $2)
         AND er.status NOT IN ('draft', 'rejected', 'cancelled')
       GROUP BY er.status`,
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
