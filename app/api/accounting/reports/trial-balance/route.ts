/**
 * API Route - Balance Générale
 * Module Comptabilité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { JournalEntryService } from '@/lib/modules/accounting/journal-entry-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new JournalEntryService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const fiscalYear = parseInt(searchParams.get('fiscalYear') || new Date().getFullYear().toString());
    const fiscalPeriod = searchParams.get('fiscalPeriod')
      ? parseInt(searchParams.get('fiscalPeriod')!)
      : undefined;

    const trialBalance = await service.getTrialBalance(workspaceId, fiscalYear, fiscalPeriod);
    return NextResponse.json({ data: trialBalance });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
