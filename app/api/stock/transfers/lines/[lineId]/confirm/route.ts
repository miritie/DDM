/**
 * POST /api/stock/transfers/lines/[lineId]/confirm
 *   Confirme une ligne de réception. Body : { qtyReceived, adjustmentReason? }
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
    if (body.qtyReceived == null) {
      return NextResponse.json({ error: 'qtyReceived requis' }, { status: 400 });
    }
    const confirmedById = await getCurrentUserId();
    const data = await service.confirmLeg(lineId, {
      qtyReceived: Number(body.qtyReceived),
      confirmedById,
      adjustmentReason: body.adjustmentReason,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
