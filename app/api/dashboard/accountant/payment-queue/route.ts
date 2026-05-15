/**
 * GET /api/dashboard/accountant/payment-queue
 *
 * Agrège les dépenses qui attendent une action du comptable :
 *   - status='approved'  : à planifier ou à payer directement
 *   - status='scheduled' : déjà planifiées, à exécuter (le moment venu)
 *
 * Retourne aussi quelques infos utiles pour décider rapidement :
 *   - montant, catégorie, demandeur
 *   - date d'approbation, date prévue de paiement (si scheduled)
 *   - expense_request_id (pour la navigation vers la sollicitation)
 *
 * Pensé comme l'équivalent de ApprovalQueue côté admin :
 * bandeau "à exécuter" sur le dashboard comptable.
 *
 * Permission : EXPENSE_PAY (le comptable doit l'avoir).
 */

import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const db = getPostgresClient();

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_PAY);
    const workspaceId = await getCurrentWorkspaceId();

    const r = await db.query<any>(
      `SELECT
         e.id, e.expense_id, e.expense_number, e.title, e.amount,
         e.status, e.scheduled_payment_date, e.updated_at,
         er.id AS expense_request_id, er.expense_request_id AS expense_request_slug,
         er.request_number,
         ec.label AS category_label, ec.code AS category_code,
         u.full_name AS requester_name
       FROM expenses e
       JOIN expense_requests er ON er.id = e.expense_request_id
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       LEFT JOIN users u ON u.id = er.requester_id
       WHERE e.workspace_id = $1
         AND e.status IN ('approved', 'scheduled')
       ORDER BY
         CASE WHEN e.status = 'scheduled' THEN e.scheduled_payment_date ELSE e.updated_at::date END ASC,
         e.amount DESC`,
      [workspaceId]
    );

    const approved = r.rows.filter((x: any) => x.status === 'approved');
    const scheduled = r.rows.filter((x: any) => x.status === 'scheduled');

    return NextResponse.json({
      data: {
        approved,
        scheduled,
        totalCount: r.rows.length,
        totalAmount: r.rows.reduce((s: number, x: any) => s + Number(x.amount || 0), 0),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
