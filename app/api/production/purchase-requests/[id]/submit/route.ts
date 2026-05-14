/**
 * POST /api/production/purchase-requests/[id]/submit
 *   Manager soumet sa sollicitation MP pour validation admin (draft → submitted).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { PurchaseRequestService } from '@/lib/modules/production/purchase-request-service';

const service = new PurchaseRequestService();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PURCHASE_REQUEST_CREATE);
    const { id } = await params;
    const data = await service.submit(id);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
