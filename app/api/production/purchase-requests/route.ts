/**
 * GET  /api/production/purchase-requests       → liste (filtres status, requesterId)
 * POST /api/production/purchase-requests       → crée une sollicitation MP en draft
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserId, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { PurchaseRequestService } from '@/lib/modules/production/purchase-request-service';

const service = new PurchaseRequestService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PURCHASE_REQUEST_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const data = await service.list(workspaceId, {
      status: searchParams.get('status') ?? undefined,
      requesterId: searchParams.get('requesterId') ?? undefined,
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
    await requirePermission(PERMISSIONS.PURCHASE_REQUEST_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const requesterId = await getCurrentUserId();
    const body = await request.json();
    const data = await service.create({
      ...body,
      workspaceId,
      requesterId: body.requesterId ?? requesterId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
