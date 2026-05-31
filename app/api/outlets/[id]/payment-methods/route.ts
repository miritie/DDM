/**
 * API — Moyens de paiement acceptés par un outlet.
 *
 * GET /api/outlets/{id}/payment-methods
 *   Renvoie { acceptedIds: string[], fallback: boolean }
 *   - acceptedIds : UUIDs des payment_methods acceptés (résolus, jamais []
 *     en pratique : si aucune config explicite, renvoie le cash par défaut).
 *   - fallback    : true si la configuration n'est pas explicite (cash auto).
 *
 * PUT /api/outlets/{id}/payment-methods { ids: string[] }
 *   Remplace en bloc la liste. ids = [] réinitialise (retour au défaut cash).
 *
 * Permissions :
 *   - GET : outlet:view (pour que le checkout-modal du vendeur puisse filtrer)
 *   - PUT : outlet:edit (admin / manager commercial / comptable)
 *
 * {id} accepte l'UUID PK ou le business code (cf. OutletService.resolveUuid).
 */

import { NextRequest, NextResponse } from 'next/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new OutletService();
const db = getPostgresClient();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const { id } = await params;

    const outletUuid = await resolveOutletUuid(id);
    if (!outletUuid) {
      return NextResponse.json({ error: 'Outlet introuvable' }, { status: 404 });
    }
    const explicitRows = await db.query(
      `SELECT payment_method_id FROM outlet_payment_methods WHERE outlet_id = $1`,
      [outletUuid]
    );
    const fallback = explicitRows.rows.length === 0;
    const acceptedIds = await service.listAcceptedPaymentMethods(id);

    return NextResponse.json({ data: { acceptedIds, fallback } });
  } catch (error: any) {
    console.error('GET outlet payment-methods error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Permission dédiée : attribuable séparément à admin / manager
    // commercial / comptable (sans donner outlet:edit large).
    await requirePermission(PERMISSIONS.OUTLET_PAYMENT_METHODS_MANAGE);
    const { id } = await params;
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === 'string') : [];

    await service.setAcceptedPaymentMethods(id, ids);
    const acceptedIds = await service.listAcceptedPaymentMethods(id);
    const explicit = ids.length > 0;

    return NextResponse.json({ data: { acceptedIds, fallback: !explicit } });
  } catch (error: any) {
    console.error('PUT outlet payment-methods error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

async function resolveOutletUuid(value: string): Promise<string | null> {
  const r = await db.query(
    `SELECT id FROM outlets WHERE id::text = $1 OR code = $1 LIMIT 1`,
    [value]
  );
  return r.rows[0]?.id ?? null;
}
