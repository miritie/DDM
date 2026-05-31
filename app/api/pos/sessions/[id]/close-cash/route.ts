/**
 * POST /api/pos/sessions/{id}/close-cash
 *   { cashCounted: number, cashWalletId: string, notes?: string }
 *
 * Fermeture de caisse formelle (Z-out) : trace le cash compté et la
 * discordance par rapport au solde wallet attendu.
 * Permission : pos:session:open (le vendeur ouvre/ferme sa propre caisse).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { PosSessionService } from '@/lib/modules/outlets/pos-session-service';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new PosSessionService();
const db = getPostgresClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.POS_SESSION_OPEN);
    const { id } = await params;
    const body = await request.json();

    if (typeof body.cashCounted !== 'number' || body.cashCounted < 0) {
      return NextResponse.json({ error: 'cashCounted invalide' }, { status: 400 });
    }
    if (!body.cashWalletId) {
      return NextResponse.json({ error: 'cashWalletId requis' }, { status: 400 });
    }

    const userIdOrSlug = await getCurrentUserId();
    const userRes = await db.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [userIdOrSlug]
    );
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 400 });
    }
    const userUuid = userRes.rows[0].id;

    const data = await service.closeWithCashCount(id, {
      cashCounted: body.cashCounted,
      cashWalletId: body.cashWalletId,
      closedByUserUuid: userUuid,
      notes: body.notes,
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('close-cash error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
