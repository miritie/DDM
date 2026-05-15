/**
 * GET /api/stock/transfers/incoming
 *
 * Transferts ayant au moins une ligne pending dont la destination a
 * l'utilisateur courant comme manager (warehouses.manager_id ou
 * outlets.manager_id).
 *
 * Pour les rôles à vue globale (admin/pca/manager_compta_stocks), retourne
 * tous les transferts ayant au moins une ligne pending.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentWorkspaceId, getCurrentUserId, getCurrentUserRoleIds,
} from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { StockTransferService } from '@/lib/modules/stock/stock-transfer-service';

const db = getPostgresClient();
const service = new StockTransferService();
const GLOBAL_VIEW_ROLES = ['admin', 'pca', 'manager_compta_stocks'];

export async function GET(_req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const userId = await getCurrentUserId();
    const roleUuids = await getCurrentUserRoleIds();

    let hasGlobalView = false;
    if (roleUuids.length > 0) {
      const r = await db.query(
        `SELECT 1 FROM roles WHERE id = ANY($1::uuid[]) AND role_id = ANY($2::text[]) LIMIT 1`,
        [roleUuids, GLOBAL_VIEW_ROLES]
      );
      hasGlobalView = r.rowCount! > 0;
    }

    const data = hasGlobalView
      // Vue globale : tous transferts avec ≥1 ligne pending → on filtre côté list
      ? (await service.list(workspaceId)).filter((t: any) =>
          (t.lines || []).some((l: any) => l.leg_status === 'pending'))
      : await service.listIncomingForUser(workspaceId, userId);

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
