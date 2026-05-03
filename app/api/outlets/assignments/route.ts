/**
 * GET  /api/outlets/assignments?outletId=&userId=&weekStart=
 * POST /api/outlets/assignments  body: {outletId,userId,weekStart,weekEnd,notes?}
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUser } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';

const service = new OutletService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const data = await service.listAssignments(workspaceId, {
      outletId: searchParams.get('outletId') || undefined,
      userId: searchParams.get('userId') || undefined,
      weekStart: searchParams.get('weekStart') || undefined,
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
    await requirePermission(PERMISSIONS.OUTLET_ASSIGN);
    const workspaceId = await getCurrentWorkspaceId();
    const me = await getCurrentUser();
    const body = await request.json();
    if (!body.outletId || !body.userId || !body.weekStart || !body.weekEnd) {
      return NextResponse.json({ error: 'outletId, userId, weekStart, weekEnd requis' }, { status: 400 });
    }
    const data = await service.createAssignment({
      ...body,
      workspaceId,
      assignedById: (me as any).userId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
