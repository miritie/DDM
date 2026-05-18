/**
 * POST /api/production/purchase-requests/[id]/reject
 *   Admin rejette la sollicitation. Réservé strictement au rôle 'admin'.
 *   Body : { reason?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/auth/require-admin-role';
import { PurchaseRequestService } from '@/lib/modules/production/purchase-request-service';

const service = new PurchaseRequestService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = await service.reject(id, body.reason);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
