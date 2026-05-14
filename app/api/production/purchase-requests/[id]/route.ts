/**
 * GET /api/production/purchase-requests/[id] → détail (avec lignes)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { PurchaseRequestService } from '@/lib/modules/production/purchase-request-service';

const service = new PurchaseRequestService();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PURCHASE_REQUEST_VIEW);
    const { id } = await params;
    const data = await service.getById(id);
    if (!data) return NextResponse.json({ error: 'Sollicitation introuvable' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
