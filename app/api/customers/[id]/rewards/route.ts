/**
 * API Routes - Récompenses d'un Client
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LoyaltyService();

/**
 * GET /api/customers/[id]/rewards
 * Liste les récompenses d'un client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const customerId = params.id;
    const rewards = await service.getCustomerRewards(customerId);

    return NextResponse.json({ data: rewards });
  } catch (error: any) {
    console.error('Error fetching customer rewards:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
