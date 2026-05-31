/**
 * API — Versements de caisse (cash_deposits)
 *
 * GET  /api/cash-deposits?outletId=X&status=Y&limit=N
 *   Liste filtrable. Permission : cash:deposit:create (vendeur voit ses dépôts)
 *   ou cash:deposit:validate (comptable voit tout).
 *
 * POST /api/cash-deposits
 *   Crée un dépôt en pending et débite immédiatement le wallet source.
 *   Permission : cash:deposit:create.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { CashDepositService } from '@/lib/modules/treasury/cash-deposit-service';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new CashDepositService();
const db = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CASH_DEPOSIT_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const data = await service.list(workspaceId, {
      outletId: searchParams.get('outletId') ?? undefined,
      status: (searchParams.get('status') as any) ?? undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CASH_DEPOSIT_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const userIdOrSlug = await getCurrentUserId();
    const body = await request.json();

    // Résolution session userId (varchar slug USR-…) → UUID PK
    const userRes = await db.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [userIdOrSlug]
    );
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 400 });
    }
    const userUuid = userRes.rows[0].id;

    // Résolution outletId (UUID ou business code)
    const outletRes = await db.query<any>(
      `SELECT id FROM outlets WHERE id::text = $1 OR code = $1 LIMIT 1`,
      [body.outletId]
    );
    if (outletRes.rows.length === 0) {
      return NextResponse.json({ error: 'Outlet introuvable' }, { status: 400 });
    }
    const outletUuid = outletRes.rows[0].id;

    const data = await service.create({
      outletId: outletUuid,
      walletSourceId: body.walletSourceId,
      destinationType: body.destinationType,
      destinationWalletId: body.destinationWalletId,
      destinationLabel: body.destinationLabel,
      amount: Number(body.amount),
      currency: body.currency,
      reference: body.reference,
      evidenceUrl: body.evidenceUrl,
      notes: body.notes,
      depositedById: userUuid,
      workspaceId,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    console.error('POST cash-deposits error:', e);
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
