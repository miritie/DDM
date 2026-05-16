/**
 * API Routes - Wallets - Liste et Création
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { WalletService } from '@/lib/modules/treasury/wallet-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new WalletService();

/**
 * GET /api/treasury/wallets - Liste des wallets
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('type')) {
      filters.type = searchParams.get('type');
    }
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const wallets = await service.list(workspaceId, filters);

    return NextResponse.json({ data: wallets });
  } catch (error: any) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/treasury/wallets - Création
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const wallet = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: wallet }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
