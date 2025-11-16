/**
 * API Routes - Congés - Opérations par ID
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { LeaveService } from '@/lib/modules/hr/leave-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LeaveService();

/**
 * GET /api/hr/leaves/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const { id } = await params;

    const leave = await service.getById(id);

    if (!leave) {
      return NextResponse.json(
        { error: 'Congé non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: leave });
  } catch (error: any) {
    console.error('Error fetching leave:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hr/leaves/[id] - Annuler
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_DELETE);
    const { id } = await params;

    await service.cancel(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling leave:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
