/**
 * API Routes - Journaux Comptables
 * Module Comptabilité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { JournalService } from '@/lib/modules/accounting/journal-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new JournalService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const journals = await service.list(workspaceId);
    return NextResponse.json({ data: journals });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    const journal = await service.create({ ...body, workspaceId });
    return NextResponse.json({ data: journal }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
