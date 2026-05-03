/**
 * GET /api/outlets/[id]/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   P&L outlet : ventes encaissées vs factures (auto-financement).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletInvoiceService } from '@/lib/modules/outlets/outlet-invoice-service';

const service = new OutletInvoiceService();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_INVOICE_VIEW);
    const { id: outletId } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || `${new Date().getFullYear()}-01-01`;
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10);
    const data = await service.getSelfFinancingReport(outletId, { from, to });
    return NextResponse.json({ data: { ...data, period: { from, to } } });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
