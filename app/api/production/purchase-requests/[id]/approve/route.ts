/**
 * POST /api/production/purchase-requests/[id]/approve
 *   Admin valide la sollicitation (submitted → approved).
 *   Effet : création automatique d'une expense (déblocage des fonds, option (a)).
 *   Permission : purchase_request:approve.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { PurchaseRequestService } from '@/lib/modules/production/purchase-request-service';

const service = new PurchaseRequestService();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PURCHASE_REQUEST_APPROVE);
    const { id } = await params;
    const approverId = await getCurrentUserId();
    const data = await service.approve(id, approverId);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
