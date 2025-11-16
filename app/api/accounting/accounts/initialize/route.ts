/**
 * API Route - Initialiser Plan Comptable
 * Module Comptabilité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AccountService } from '@/lib/modules/accounting/account-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AccountService();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const accounts = await service.initializeChartOfAccounts(workspaceId);
    return NextResponse.json({ data: accounts }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
