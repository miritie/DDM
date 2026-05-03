/**
 * GET  /api/outlets/[id]/periods         — historique des périodes pour un outlet
 * POST /api/outlets/[id]/periods         — crée une période d'activité (active/inactive, frais)
 *   body: { startDate, endDate?, isActive?, isPaid?, feeAmount?, feePeriod?, notes? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';

const service = new OutletService();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const { id } = await params;
    const data = await service.listPeriods(id);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const { id } = await params;
    const body = await request.json();
    if (!body.startDate) return NextResponse.json({ error: 'startDate requis' }, { status: 400 });
    const data = await service.createPeriod({ ...body, outletId: id, workspaceId });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
