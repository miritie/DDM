/**
 * API Routes - Segment de Clients (détails)
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { SegmentService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new SegmentService();

/**
 * GET /api/customers/segments/[id]
 * Récupère un segment par ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const segment = await service.getById(id);

    if (!segment) {
      return NextResponse.json({ error: 'Segment non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ data: segment });
  } catch (error: any) {
    console.error('Error fetching segment:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * PATCH /api/customers/segments/[id]
 * Met à jour un segment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requirePermission(PERMISSIONS.CUSTOMER_EDIT);

    const body = await request.json();
    const segment = await service.update(id, body);

    return NextResponse.json({ data: segment });
  } catch (error: any) {
    console.error('Error updating segment:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
