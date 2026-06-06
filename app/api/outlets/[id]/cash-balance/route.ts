/**
 * GET /api/outlets/{id}/cash-balance
 *
 * Renvoie le wallet caisse associé au stand + son solde courant.
 *
 * Résolution de la caisse du stand :
 *   - 0) Wallet actif type=cash LIÉ au stand (wallets.outlet_id) — posé par
 *        le script ensure-outlet-cash-wallets (auto au déploiement)
 *   - 1) Sinon, wallet cash dont le nom contient le nom de l'outlet (V1)
 *   - 2) Sinon, null — PLUS de repli « premier wallet du workspace » :
 *        il renvoyait la caisse d'un AUTRE stand (tiroir-caisse erroné).
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

    // 0) Wallet explicitement lié au stand (colonne posée par migration —
    //    to_regclass-style guard inutile : ADD COLUMN IF NOT EXISTS est
    //    exécuté au déploiement avant que ce code ne tourne ; en attendant,
    //    une colonne absente ferait tomber sur le catch → on protège quand
    //    même via une détection souple).
    let wallet: any = null;
    try {
      const linkedRes = await db.query<any>(
        `SELECT id, name, balance, type FROM wallets
         WHERE workspace_id = $1 AND type = 'cash' AND is_active = true
           AND outlet_id = $2
         ORDER BY name LIMIT 1`,
        [workspaceId, outlet.id]
      );
      wallet = linkedRes.rows[0] ?? null;
    } catch {
      // colonne outlet_id pas encore migrée — on retombe sur la convention nom
    }

    if (!wallet) {
      // 1) Wallet cash dont le nom contient le nom de l'outlet (convention V1)
      const matchRes = await db.query<any>(
        `SELECT id, name, balance, type FROM wallets
         WHERE workspace_id = $1 AND type = 'cash' AND is_active = true
           AND name ILIKE $2
         ORDER BY name LIMIT 1`,
        [workspaceId, '%' + outlet.name + '%']
      );
      wallet = matchRes.rows[0] ?? null;
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
