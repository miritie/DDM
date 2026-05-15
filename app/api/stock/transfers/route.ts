/**
 * GET  /api/stock/transfers     → liste (?status=…)
 * POST /api/stock/transfers     → crée un transfert 1→N
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { StockTransferService } from '@/lib/modules/stock/stock-transfer-service';

const service = new StockTransferService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const data = await service.list(workspaceId, {
      status: searchParams.get('status') ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_TRANSFER);
    const workspaceId = await getCurrentWorkspaceId();
    const initiatedById = await getCurrentUserId();
    const body = await request.json();
    const data = await service.create({
      ...body,
      workspaceId,
      initiatedById: body.initiatedById ?? initiatedById,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
