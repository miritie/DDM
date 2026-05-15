/**
 * POST /api/stock/transfers/lines/[lineId]/refuse
 *   Refuse une ligne (retour intégral à la source). Body : { reason? }
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
    const body = await request.json().catch(() => ({}));
    const refusedById = await getCurrentUserId();
    const data = await service.refuseLeg(lineId, {
      refusedById,
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
