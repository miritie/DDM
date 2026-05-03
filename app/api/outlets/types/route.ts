import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';

const service = new OutletService();

export async function GET(_request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const data = await service.listTypes(workspaceId);
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
    await requirePermission(PERMISSIONS.OUTLET_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    if (!body.code || !body.name) {
      return NextResponse.json({ error: 'code et name requis' }, { status: 400 });
    }
    const data = await service.createType({ ...body, workspaceId });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
