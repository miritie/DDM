/**
 * API Routes - Top Clients
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { CustomerService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new CustomerService();

/**
 * GET /api/customers/top?limit=10
 * Récupère les meilleurs clients
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const customers = await service.getTopCustomers(workspaceId, limit);

    return NextResponse.json({ data: customers });
  } catch (error: any) {
    console.error('Error fetching top customers:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
