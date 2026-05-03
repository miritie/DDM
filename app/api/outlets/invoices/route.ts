/**
 * GET  /api/outlets/invoices?outletId=&status=&year=&month=
 * POST /api/outlets/invoices  body: {outletId,invoiceNumber,periodYear,periodMonth,amount,issueDate,dueDate,notes?}
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletInvoiceService } from '@/lib/modules/outlets/outlet-invoice-service';

const service = new OutletInvoiceService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_INVOICE_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const data = await service.list(workspaceId, {
      outletId: searchParams.get('outletId') || undefined,
      status: (searchParams.get('status') as any) || undefined,
      year: searchParams.get('year') ? Number(searchParams.get('year')) : undefined,
      month: searchParams.get('month') ? Number(searchParams.get('month')) : undefined,
    });
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_INVOICE_MANAGE);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    const required = ['outletId', 'invoiceNumber', 'periodYear', 'periodMonth', 'amount', 'issueDate', 'dueDate'];
    for (const f of required) {
      if (body[f] === undefined || body[f] === null) {
        return NextResponse.json({ error: `${f} requis` }, { status: 400 });
      }
    }
    const data = await service.create({ ...body, workspaceId });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
