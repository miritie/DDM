/**
 * POST /api/replenishments/[id]/distribute
 *   body: {
 *     targetId: string (UUID),
 *     quantity: number,            // peut être partielle
 *     sourceWarehouseId: string,   // entrepôt source (usine / dépôt général)
 *     notes?: string,
 *   }
 *
 * Met à jour stock_items source/dest + crée un stock_movement type 'transfer'
 * lié au target. Si tous les targets ont 100 %, passe l'order en 'distributed'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { ReplenishmentService } from '@/lib/modules/replenishments/replenishment-service';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new ReplenishmentService();
const db = getPostgresClient();

async function resolveWarehouseUuid(idOrSlug: string, workspaceId: string): Promise<string | null> {
  const r = await db.query(
    `SELECT id FROM warehouses WHERE workspace_id=$1 AND (id::text=$2 OR warehouse_id=$2) LIMIT 1`,
    [workspaceId, idOrSlug]
  );
  return r.rows[0]?.id ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.REPLENISHMENT_DISTRIBUTE);
    const workspaceId = await getCurrentWorkspaceId();
    const me = await getCurrentUser();
    await params; // id non utilisé directement (target appartient à l'order)
    const body = await req.json();

    if (!body.targetId || !body.quantity || !body.sourceWarehouseId) {
      return NextResponse.json({ error: 'targetId, quantity et sourceWarehouseId requis' }, { status: 400 });
    }
    const warehouseUuid = await resolveWarehouseUuid(body.sourceWarehouseId, workspaceId);
    if (!warehouseUuid) {
      return NextResponse.json({ error: 'Entrepôt source introuvable' }, { status: 400 });
    }

    const data = await service.distribute({
      workspaceId,
      processedById: (me as any).userId,
      targetId: body.targetId,
      quantity: Number(body.quantity),
      sourceWarehouseId: warehouseUuid,
      notes: body.notes,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
