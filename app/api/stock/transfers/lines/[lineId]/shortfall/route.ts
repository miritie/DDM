/**
 * POST /api/stock/transfers/lines/[lineId]/shortfall
 *   Émetteur arbitre l'écart d'une ligne ajustée.
 *   Body : { decision: 'declared_loss' | 'returned_to_source' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { StockTransferService } from '@/lib/modules/stock/stock-transfer-service';

const service = new StockTransferService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ lineId: string }> }) {
  try {
    await requirePermission(PERMISSIONS.STOCK_TRANSFER);
    const { lineId } = await params;
    const body = await request.json();
    if (body.decision !== 'declared_loss' && body.decision !== 'returned_to_source') {
      return NextResponse.json(
        { error: "decision doit être 'declared_loss' ou 'returned_to_source'" },
        { status: 400 }
      );
    }
    const decidedById = await getCurrentUserId();
    const data = await service.decideShortfall(lineId, {
      decision: body.decision,
      decidedById,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
