/**
 * API Routes - Segments de Clients
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { SegmentService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new SegmentService();

/**
 * GET /api/customers/segments
 * Liste les segments de clients
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const segments = await service.list(workspaceId, activeOnly);

    return NextResponse.json({ data: segments });
  } catch (error: any) {
    console.error('Error fetching segments:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/customers/segments
 * Crée un segment de clients
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_EDIT);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const segment = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: segment }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating segment:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
