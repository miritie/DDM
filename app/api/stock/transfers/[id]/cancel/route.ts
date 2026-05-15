/**
 * POST /api/stock/transfers/[id]/cancel
 *   Annule un transfert encore in_transit ; les legs pending sont retournés
 *   au stock source.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { StockTransferService } from '@/lib/modules/stock/stock-transfer-service';

const service = new StockTransferService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.STOCK_TRANSFER);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = await service.cancel(id, body.reason);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
