/**
 * GET  /api/outlets               — liste les outlets du workspace
 * POST /api/outlets               — crée un outlet
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';

const service = new OutletService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const filters: any = {};
    const isActive = searchParams.get('isActive');
    if (isActive !== null) filters.isActive = isActive === 'true';
    const outletTypeId = searchParams.get('outletTypeId');
    if (outletTypeId) filters.outletTypeId = outletTypeId;
    const data = await service.list(workspaceId, filters);
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
    const data = await service.create({ ...body, workspaceId });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
