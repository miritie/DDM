/**
 * API Route - Présences automatiques des commerciaux (via POS)
 * GET /api/hr/attendance/pos-presence?date=YYYY-MM-DD
 *
 * La présence d'un commercial n'est PAS pointée manuellement : elle est
 * déduite de son activité de caisse (sessions POS du jour) et confirmée
 * par la prime de transport versée à la clôture. Une ligne par vendeur
 * et par stand : première ouverture, dernière fermeture, ventes, prime.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { ensurePayrollTable } from '@/lib/modules/hr/payroll-service';
import { handleApiError } from '@/lib/http/api-error';

const db = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    await ensurePayrollTable(); // garantit commission_payouts
    const date = request.nextUrl.searchParams.get('date')
      ?? new Date().toISOString().slice(0, 10);

    const r = await db.query(
      `SELECT u.full_name AS "SellerName",
              o.name AS "OutletName",
              MIN(ps.started_at) AS "FirstIn",
              MAX(ps.ended_at) AS "LastOut",
              COUNT(DISTINCT ps.id)::int AS "Sessions",
              COALESCE((
                SELECT SUM(s.total_amount)::float FROM sales s
                WHERE s.workspace_id = $1 AND s.sales_person_id = ps.user_id
                  AND s.outlet_id = ps.outlet_id AND s.sale_date::date = $2::date
                  AND s.status != 'cancelled'
              ), 0) AS "Revenue",
              EXISTS (
                SELECT 1 FROM commission_payouts cp
                WHERE cp.seller_user_id = ps.user_id AND cp.outlet_id = ps.outlet_id
                  AND cp.payout_date = $2::date AND cp.kind = 'transport'
              ) AS "TransportPaid"
       FROM pos_sessions ps
       JOIN users u ON u.id = ps.user_id
       JOIN outlets o ON o.id = ps.outlet_id
       WHERE ps.workspace_id = $1 AND ps.started_at::date = $2::date
       GROUP BY ps.user_id, ps.outlet_id, u.full_name, o.name
       ORDER BY u.full_name`,
      [workspaceId, date]
    );

    return NextResponse.json({ data: r.rows });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement des présences POS');
  }
}
