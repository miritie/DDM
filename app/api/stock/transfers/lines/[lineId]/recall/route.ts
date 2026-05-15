/**
 * POST /api/stock/transfers/lines/[lineId]/recall
 *   L'émetteur du transfert rappelle une ligne pending (retour à la source).
 *   Body : { reason? }
 *   Différent de /refuse (qui vient du destinataire) — ici c'est l'émetteur
 *   qui retire sa propre proposition.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { StockTransferService } from '@/lib/modules/stock/stock-transfer-service';

const db = getPostgresClient();
const service = new StockTransferService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ lineId: string }> }) {
  try {
    await requirePermission(PERMISSIONS.STOCK_TRANSFER);
    const { lineId } = await params;
    const recalledById = await getCurrentUserId();

    // Vérifie que l'utilisateur est bien l'émetteur du transfert parent
    const ownerR = await db.query(
      `SELECT t.initiated_by_id, u.user_id AS initiator_slug
       FROM stock_transfer_lines l
       JOIN stock_transfers t ON t.id = l.transfer_id
       LEFT JOIN users u ON u.id = t.initiated_by_id
       WHERE l.id::text = $1 OR l.transfer_line_id = $1
       LIMIT 1`,
      [lineId]
    );
    if (ownerR.rowCount === 0) {
      return NextResponse.json({ error: 'Ligne introuvable' }, { status: 404 });
    }
    if (ownerR.rows[0].initiator_slug !== recalledById) {
      return NextResponse.json(
        { error: 'Seul l\'émetteur du transfert peut rappeler une ligne' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const data = await service.recallLeg(lineId, {
      recalledById,
      reason: body.reason,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
