/**
 * API Routes - Clients à Risque
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { CustomerService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new CustomerService();

/**
 * GET /api/customers/at-risk?days=90
 * Récupère les clients à risque (n'ayant pas commandé depuis X jours)
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90');

    const customers = await service.getAtRiskCustomers(workspaceId, days);

    return NextResponse.json({
      data: customers,
      message: `${customers.length} clients n'ont pas commandé depuis ${days} jours`,
    });
  } catch (error: any) {
    console.error('Error fetching at-risk customers:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
