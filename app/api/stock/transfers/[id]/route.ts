/**
 * GET /api/stock/transfers/[id] → détail (avec lignes + flag isInitiator)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { StockTransferService } from '@/lib/modules/stock/stock-transfer-service';

const db = getPostgresClient();
const service = new StockTransferService();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const { id } = await params;
    const data = await service.getById(id);
    if (!data) return NextResponse.json({ error: 'Transfert introuvable' }, { status: 404 });

    // Calcule isInitiator : l'utilisateur courant est-il l'émetteur ?
    const userIdSlug = await getCurrentUserId();
    const userR = await db.query(`SELECT id FROM users WHERE user_id = $1 OR id::text = $1 LIMIT 1`, [userIdSlug]);
    const userUuid = userR.rows[0]?.id;
    const isInitiator = userUuid && userUuid === data.initiated_by_id;

    return NextResponse.json({ data: { ...data, isInitiator } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
