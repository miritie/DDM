/**
 * GET /api/dashboard/approval-queue
 *
 * Agrège tout ce qui attend une validation admin :
 *   - customer_orders status='submitted'                 (commandes négociées)
 *   - production_orders status='submitted'               (OP à approuver)
 *   - expense_requests achat_mp status='submitted'       (achats MP)
 *   - stand_replenishment_orders status='submitted'      (réappro stands)
 *
 * Permission : admin ou tout user avec une perm d'approbation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const db = getPostgresClient();

export async function GET(_req: NextRequest) {
  try {
    // Au moins une permission d'approbation
    try {
      await requirePermission(PERMISSIONS.PRODUCTION_APPROVE);
    } catch {
      try {
        await requirePermission(PERMISSIONS.PURCHASE_REQUEST_APPROVE);
      } catch {
        try {
          await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
        } catch {
          await requirePermission(PERMISSIONS.REPLENISHMENT_APPROVE);
        }
      }
    }

    const workspaceId = await getCurrentWorkspaceId();
    // workspaceId vient en UUID via getCurrentWorkspaceId — pas besoin de resolve.

    const [coR, poR, prR, rpR] = await Promise.all([
      // Commandes clients soumises
      db.query(
        `SELECT id, order_id, order_number, client_name, total_amount, currency,
                created_at, requested_by_id
         FROM customer_orders
         WHERE workspace_id = $1 AND status = 'submitted'
         ORDER BY updated_at DESC LIMIT 50`,
        [workspaceId]
      ),
      // Ordres de production soumis
      db.query(
        `SELECT po.id, po.production_order_id, po.order_number, po.product_name,
                po.planned_quantity, po.unit, po.submitted_at, po.priority,
                po.customer_order_id, co.order_number AS customer_order_number
         FROM production_orders po
         LEFT JOIN customer_orders co ON co.id = po.customer_order_id
         WHERE po.workspace_id = $1 AND po.status = 'submitted'
         ORDER BY po.submitted_at DESC NULLS LAST LIMIT 50`,
        [workspaceId]
      ),
      // Sollicitations achat MP (expense_requests catégorie 'achat_mp')
      db.query(
        `SELECT er.id, er.expense_request_id, er.request_number, er.title,
                er.amount, er.submitted_at, ec.code AS category_code
         FROM expense_requests er
         JOIN expense_categories ec ON ec.id = er.category_id
         WHERE er.workspace_id = $1 AND er.status = 'submitted'
           AND ec.code = 'achat_mp'
         ORDER BY er.submitted_at DESC NULLS LAST LIMIT 50`,
        [workspaceId]
      ),
      // Réapprovisionnements stands (depuis l'usine vers les points de vente)
      db.query(
        `SELECT r.id, r.replenishment_id, r.replenishment_number,
                r.total_value_estimate, r.requested_delivery_date,
                r.updated_at,
                u.full_name AS requested_by_name,
                (SELECT COUNT(*)::int FROM stand_replenishment_lines WHERE replenishment_id = r.id) AS line_count
         FROM stand_replenishment_orders r
         LEFT JOIN users u ON u.id = r.requested_by_id
         WHERE r.workspace_id = $1 AND r.status = 'submitted'
         ORDER BY r.updated_at DESC LIMIT 50`,
        [workspaceId]
      ),
    ]);

    return NextResponse.json({
      data: {
        customerOrders: coR.rows,
        productionOrders: poR.rows,
        purchaseRequests: prR.rows,
        replenishments: rpR.rows,
        totalCount: coR.rowCount! + poR.rowCount! + prR.rowCount! + rpR.rowCount!,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
