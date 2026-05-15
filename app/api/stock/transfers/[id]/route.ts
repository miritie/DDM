/**
 * GET /api/stock/transfers/[id] → détail (avec lignes)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { StockTransferService } from '@/lib/modules/stock/stock-transfer-service';

const service = new StockTransferService();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const { id } = await params;
    const data = await service.getById(id);
    if (!data) return NextResponse.json({ error: 'Transfert introuvable' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
