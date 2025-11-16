/**
 * API Routes - Récompenses de Fidélité
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { LoyaltyService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LoyaltyService();

/**
 * GET /api/customers/loyalty/rewards
 * Liste les récompenses disponibles
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};

    if (searchParams.get('type')) {
      filters.type = searchParams.get('type');
    }

    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    if (searchParams.get('minimumTier')) {
      filters.minimumTier = searchParams.get('minimumTier');
    }

    const rewards = await service.listRewards(workspaceId, filters);

    return NextResponse.json({ data: rewards });
  } catch (error: any) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
