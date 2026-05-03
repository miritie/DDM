/**
 * POST /api/outlets/assignment-overrides
 *   body: {outletId, userId, dateFrom, dateTo, reason?}
 *   Crée une exception ad-hoc qui surcharge le planning hebdo sur la plage donnée.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUser } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';

const service = new OutletService();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_ASSIGN);
    const workspaceId = await getCurrentWorkspaceId();
    const me = await getCurrentUser();
    const body = await request.json();
    if (!body.outletId || !body.userId || !body.dateFrom || !body.dateTo) {
      return NextResponse.json({ error: 'outletId, userId, dateFrom, dateTo requis' }, { status: 400 });
    }
    const data = await service.createOverride({
      ...body,
      workspaceId,
      assignedById: (me as any).userId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
