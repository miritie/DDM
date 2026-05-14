/**
 * GET  /api/replenishments — liste (?status=...)
 * POST /api/replenishments — créer un approvisionnement
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { ReplenishmentService, ReplenishmentStatus } from '@/lib/modules/replenishments/replenishment-service';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new ReplenishmentService();
const db = getPostgresClient();

async function resolveOutletUuid(idOrSlug: string, workspaceId: string): Promise<string | null> {
  const r = await db.query(
    `SELECT id FROM outlets WHERE workspace_id=$1 AND (id::text=$2 OR code=$2) LIMIT 1`,
    [workspaceId, idOrSlug]
  );
  return r.rows[0]?.id ?? null;
}

async function resolveProductUuid(idOrSlug: string): Promise<string | null> {
  const r = await db.query(
    `SELECT id FROM products WHERE id::text=$1 OR product_id=$1 OR code=$1 LIMIT 1`,
    [idOrSlug]
  );
  return r.rows[0]?.id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPLENISHMENT_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const filters: { status?: ReplenishmentStatus } = {};
    const status = searchParams.get('status');
    if (status) filters.status = status as ReplenishmentStatus;
    const data = await service.list(workspaceId, filters);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPLENISHMENT_CREATE);
    const me = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: 'Au moins une ligne est requise' }, { status: 400 });
    }

    // Résolution UUID des produits et outlets
    const resolvedLines = [];
    for (const l of body.lines) {
      const productUuid = await resolveProductUuid(l.productId);
      if (!productUuid) return NextResponse.json({ error: `Produit introuvable : ${l.productId}` }, { status: 400 });
      const targets = [];
      for (const t of (l.targets || [])) {
        const outletUuid = await resolveOutletUuid(t.outletId, workspaceId);
        if (!outletUuid) return NextResponse.json({ error: `Stand introuvable : ${t.outletId}` }, { status: 400 });
        targets.push({ outletId: outletUuid, quantityTarget: Number(t.quantityTarget) });
      }
      resolvedLines.push({
        productId: productUuid,
        quantityRequested: Number(l.quantityRequested),
        unitCost: l.unitCost !== undefined ? Number(l.unitCost) : undefined,
        notes: l.notes,
        targets,
      });
    }

    const data = await service.create({
      workspaceId,
      requestedById: (me as any).userId,
      notes: body.notes,
      requestedDeliveryDate: body.requestedDeliveryDate,
      lines: resolvedLines,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 });
  }
}
