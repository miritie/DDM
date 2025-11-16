/**
 * API Routes - Échange de Récompenses
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { LoyaltyService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LoyaltyService();

/**
 * POST /api/customers/loyalty/rewards/redeem
 * Échange des points contre une récompense
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_EDIT);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const { customerId, rewardId } = body;

    if (!customerId || !rewardId) {
      return NextResponse.json(
        { error: 'customerId et rewardId sont requis' },
        { status: 400 }
      );
    }

    const customerReward = await service.redeemReward(customerId, rewardId, workspaceId);

    return NextResponse.json({ data: customerReward }, { status: 201 });
  } catch (error: any) {
    console.error('Error redeeming reward:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'échange' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
