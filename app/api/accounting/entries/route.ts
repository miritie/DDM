/**
 * API Routes - Écritures Comptables
 * Module Comptabilité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { JournalEntryService } from '@/lib/modules/accounting/journal-entry-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new JournalEntryService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('journalId')) filters.journalId = searchParams.get('journalId');
    if (searchParams.get('status')) filters.status = searchParams.get('status');

    const entries = await service.list(workspaceId, filters);
    return NextResponse.json({ data: entries });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    const entry = await service.create({ ...body, workspaceId });
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
