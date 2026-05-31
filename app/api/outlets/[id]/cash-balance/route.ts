/**
 * GET /api/outlets/{id}/cash-balance
 *
 * Renvoie le wallet caisse associé au stand + son solde courant.
 *
 * Convention V1 (sans colonne outlets.cash_wallet_id) :
 *   - 1) Cherche un wallet actif type=cash dont le nom contient le nom
 *        de l'outlet (ex. « Caisse Playce Marcory »).
 *   - 2) Sinon, prend le premier wallet actif type=cash du workspace.
 *   - 3) Sinon, renvoie null (à configurer côté admin).
 *
 * Réponse :
 *   { data: { wallet: { id, name, balance } | null } }
 *
 * Permission : cash:deposit:create (le vendeur doit pouvoir consulter
 * sa caisse pour décider du montant à déposer).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CASH_DEPOSIT_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const { id } = await params;

    const outletRes = await db.query<any>(
      `SELECT id, name FROM outlets WHERE id::text = $1 OR code = $1 LIMIT 1`,
      [id]
    );
    if (outletRes.rows.length === 0) {
      return NextResponse.json({ error: 'Outlet introuvable' }, { status: 404 });
    }
    const outlet = outletRes.rows[0];

    // 1) Wallet cash dont le nom contient le nom de l'outlet
    const matchRes = await db.query<any>(
      `SELECT id, name, balance, type FROM wallets
       WHERE workspace_id = $1 AND type = 'cash' AND is_active = true
         AND name ILIKE $2
       ORDER BY name LIMIT 1`,
      [workspaceId, '%' + outlet.name + '%']
    );

    let wallet = matchRes.rows[0];
    if (!wallet) {
      // 2) Fallback : premier wallet cash actif du workspace
      const fallbackRes = await db.query<any>(
        `SELECT id, name, balance, type FROM wallets
         WHERE workspace_id = $1 AND type = 'cash' AND is_active = true
         ORDER BY name LIMIT 1`,
        [workspaceId]
      );
      wallet = fallbackRes.rows[0];
    }

    return NextResponse.json({
      data: {
        wallet: wallet ? {
          id: wallet.id,
          name: wallet.name,
          balance: Number(wallet.balance),
        } : null,
      },
    });
  } catch (e: any) {
    console.error('cash-balance error:', e);
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
