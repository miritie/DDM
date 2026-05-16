/**
 * API Routes - Plan Comptable
 * Module Comptabilité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AccountService } from '@/lib/modules/accounting/account-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AccountService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const accounts = await service.list(workspaceId);
    return NextResponse.json({ data: accounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    const account = await service.create({ ...body, workspaceId });
    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
