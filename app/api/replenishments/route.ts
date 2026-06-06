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

    // Résolution UUID des produits et outlets.
    // On valide TOUTES les lignes avant de créer quoi que ce soit, et on
    // renvoie la liste complète des problèmes (au lieu de s'arrêter à la
    // première ligne invalide, ce qui forçait l'utilisateur à corriger
    // erreur par erreur sans visibilité sur le reste).
    const resolvedLines = [];
    const validationErrors: Array<{ line: number; error: string }> = [];
    for (let i = 0; i < body.lines.length; i++) {
      const l = body.lines[i];
      const productUuid = await resolveProductUuid(l.productId);
      if (!productUuid) {
        validationErrors.push({ line: i + 1, error: `Produit introuvable : ${l.productId}` });
        continue;
      }
      const quantityRequested = Number(l.quantityRequested);
      if (!Number.isFinite(quantityRequested) || quantityRequested <= 0) {
        validationErrors.push({ line: i + 1, error: `Quantité demandée invalide : ${l.quantityRequested}` });
        continue;
      }
      const targets = [];
      let lineValid = true;
      for (const t of (l.targets || [])) {
        const outletUuid = await resolveOutletUuid(t.outletId, workspaceId);
        if (!outletUuid) {
          validationErrors.push({ line: i + 1, error: `Stand introuvable : ${t.outletId}` });
          lineValid = false;
          continue;
        }
        targets.push({ outletId: outletUuid, quantityTarget: Number(t.quantityTarget) });
      }
      if (!lineValid) continue;
      resolvedLines.push({
        productId: productUuid,
        quantityRequested,
        unitCost: l.unitCost !== undefined ? Number(l.unitCost) : undefined,
        notes: l.notes,
        targets,
      });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: validationErrors.length === 1
          ? validationErrors[0].error
          : `${validationErrors.length} lignes invalides — rien n'a été créé`,
        details: validationErrors,
      }, { status: 400 });
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
