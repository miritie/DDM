/**
 * GET  /api/outlets/prices?outletId=...&productId=...
 * POST /api/outlets/prices  body: { productId, outletId|outletTypeId, unitPrice, validFrom?, validTo? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';

const service = new OutletService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const data = await service.listPrices(workspaceId, {
      outletId: searchParams.get('outletId') || undefined,
      outletTypeId: searchParams.get('outletTypeId') || undefined,
      productId: searchParams.get('productId') || undefined,
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
    await requirePermission(PERMISSIONS.OUTLET_PRICE_MANAGE);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    if (!body.productId || body.unitPrice === undefined) {
      return NextResponse.json({ error: 'productId et unitPrice requis' }, { status: 400 });
    }
    const data = await service.upsertPrice({ ...body, workspaceId });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
