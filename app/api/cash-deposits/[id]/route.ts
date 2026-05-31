/**
 * API — Validation / rejet d'un versement de caisse.
 *
 * PATCH /api/cash-deposits/{id} { action: 'validate' | 'reject' }
 * Permission : cash:deposit:validate (comptable, admin).
 *
 * Validate : marque validated, RAS (wallet déjà débité).
 * Reject   : marque rejected + re-crédite le wallet caisse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { CashDepositService } from '@/lib/modules/treasury/cash-deposit-service';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new CashDepositService();
const db = getPostgresClient();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CASH_DEPOSIT_VALIDATE);
    const { id } = await params;
    const body = await request.json();

    if (body.action !== 'validate' && body.action !== 'reject') {
      return NextResponse.json({ error: "action doit valoir 'validate' ou 'reject'" }, { status: 400 });
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

    const data = body.action === 'validate'
      ? await service.validate(id, userUuid)
      : await service.reject(id, userUuid);

    return NextResponse.json({ data });
  } catch (e: any) {
    console.error('PATCH cash-deposit error:', e);
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
