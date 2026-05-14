/**
 * GET /api/dashboard/production-queue
 *
 * Renvoie les commandes clients prêtes à être produites (status='approved'
 * ou 'in_production') du workspace, avec les lignes de produits et l'OP
 * éventuellement déjà lié. Sert de "corbeille" au manager_production sans
 * lui donner accès au module sales/customer-orders complet.
 *
 * Permission : production:view (suffisant pour manager_production).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const db = getPostgresClient();

export async function GET(_req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_VIEW);
    const workspaceId = await getCurrentWorkspaceId();

    // Commandes prêtes à produire ou déjà en cours
    const ordersR = await db.query(
      `SELECT
         co.id, co.order_id, co.order_number, co.client_name, co.client_phone,
         co.total_amount, co.currency, co.status, co.requested_delivery_date,
         co.approved_at, co.notes,
         c.name AS client_full_name,
         (SELECT COUNT(*)::int FROM customer_order_lines col WHERE col.customer_order_id = co.id) AS line_count,
         (SELECT po.production_order_id FROM production_orders po WHERE po.customer_order_id = co.id LIMIT 1) AS linked_op_id,
         (SELECT po.status::text FROM production_orders po WHERE po.customer_order_id = co.id LIMIT 1) AS linked_op_status
       FROM customer_orders co
       LEFT JOIN clients c ON c.id = co.client_id
       WHERE co.workspace_id = $1
         AND co.status IN ('approved', 'in_production')
       ORDER BY co.approved_at DESC NULLS LAST, co.updated_at DESC`,
      [workspaceId]
    );

    // Charge les lignes pour chaque commande
    for (const order of ordersR.rows) {
      const linesR = await db.query(
        `SELECT col.id, col.product_id, col.product_name, col.quantity, col.unit_price, col.line_total,
                p.code AS product_code,
                (SELECT r.recipe_id FROM recipes r
                 WHERE r.product_id = col.product_id AND r.is_active = true AND r.workspace_id = $2
                 ORDER BY r.version DESC LIMIT 1) AS available_recipe_slug
         FROM customer_order_lines col
         JOIN products p ON p.id = col.product_id
         WHERE col.customer_order_id = $1
         ORDER BY col.created_at`,
        [order.id, workspaceId]
      );
      order.lines = linesR.rows;
    }

    const pending = ordersR.rows.filter((o) => !o.linked_op_id);
    const inProgress = ordersR.rows.filter((o) => !!o.linked_op_id);

    // Réappro stands à produire (validés par admin, à fabriquer)
    const replenishmentsR = await db.query(
      `SELECT r.id, r.replenishment_id, r.replenishment_number, r.status,
              r.total_value_estimate, r.requested_delivery_date, r.notes,
              r.approved_at, r.production_order_id,
              u.full_name AS requested_by_name,
              (SELECT po.production_order_id FROM production_orders po
               WHERE po.id = r.production_order_id LIMIT 1) AS linked_op_slug,
              (SELECT po.status::text FROM production_orders po
               WHERE po.id = r.production_order_id LIMIT 1) AS linked_op_status
       FROM stand_replenishment_orders r
       LEFT JOIN users u ON u.id = r.requested_by_id
       WHERE r.workspace_id = $1
         AND r.status IN ('approved', 'in_production')
       ORDER BY r.approved_at DESC NULLS LAST, r.updated_at DESC`,
      [workspaceId]
    );
    // Charge les lignes pour chaque réappro
    for (const r of replenishmentsR.rows) {
      const linesR = await db.query(
        `SELECT rl.id, rl.product_id, rl.product_name,
                rl.quantity_requested, rl.quantity_produced,
                p.code AS product_code,
                (SELECT rc.recipe_id FROM recipes rc
                 WHERE rc.product_id = rl.product_id AND rc.is_active = true AND rc.workspace_id = $2
                 ORDER BY rc.version DESC LIMIT 1) AS available_recipe_slug
         FROM stand_replenishment_lines rl
         JOIN products p ON p.id = rl.product_id
         WHERE rl.replenishment_id = $1
         ORDER BY rl.created_at`,
        [r.id, workspaceId]
      );
      r.lines = linesR.rows;
    }

    return NextResponse.json({
      data: {
        pending,                                          // commandes clients
        inProgress,                                       // commandes clients en cours
        replenishmentsPending: replenishmentsR.rows.filter((r) => !r.linked_op_slug),
        replenishmentsInProgress: replenishmentsR.rows.filter((r) => !!r.linked_op_slug),
        totalCount: ordersR.rowCount! + replenishmentsR.rowCount!,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
