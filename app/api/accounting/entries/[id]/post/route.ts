/**
 * API Route - Comptabiliser Écriture
 * Module Comptabilité
 */

import { NextRequest, NextResponse } from 'next/server';
import { JournalEntryService } from '@/lib/modules/accounting/journal-entry-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new JournalEntryService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const { id } = await params;
    const body = await request.json();
    const entry = await service.post(id, body.postedById);
    return NextResponse.json({ data: entry });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
