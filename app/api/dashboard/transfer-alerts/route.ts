/**
 * GET /api/dashboard/transfer-alerts
 *
 * Renvoie le nombre de lignes de transfert en attente dans le workspace
 * (pour afficher un badge alerte dans le bandeau global).
 *
 * Permission : stock:view (suffisant pour les utilisateurs ayant accès au
 * module stock).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { StockTransferService } from '@/lib/modules/stock/stock-transfer-service';

const service = new StockTransferService();

export async function GET(_req: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const pendingLegs = await service.countPendingLegs(workspaceId);
    return NextResponse.json({ data: { pendingLegs } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
