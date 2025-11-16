/**
 * API Routes - Comptes (Tiers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AccountService } from '@/lib/modules/advances-debts/account-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AccountService();

/**
 * GET /api/accounts
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('accountType')) {
      filters.accountType = searchParams.get('accountType');
    }
    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const accounts = await service.list(workspaceId, filters);

    return NextResponse.json({ data: accounts });
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADVANCE_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const account = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: account }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
