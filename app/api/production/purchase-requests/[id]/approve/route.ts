/**
 * POST /api/production/purchase-requests/[id]/approve
 *   Admin valide la sollicitation (submitted → approved).
 *   Effet : création automatique d'une expense (déblocage des fonds).
 *   Réservé strictement au rôle 'admin' (séparation décideur/opérationnel).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/auth/require-admin-role';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { PurchaseRequestService } from '@/lib/modules/production/purchase-request-service';

const service = new PurchaseRequestService();

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PURCHASE_REQUEST_APPROVE);
    await requireAdminRole();
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
