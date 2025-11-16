/**
 * API Routes - Clients d'un Segment
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { SegmentService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new SegmentService();

/**
 * GET /api/customers/segments/[id]/customers
 * Récupère les clients d'un segment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const customers = await service.getSegmentCustomers(id, workspaceId);

    return NextResponse.json({ data: customers });
  } catch (error: any) {
    console.error('Error fetching segment customers:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
