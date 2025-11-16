/**
 * API Routes - Présences - Opérations par ID
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { AttendanceService } from '@/lib/modules/hr/attendance-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AttendanceService();

/**
 * GET /api/hr/attendance/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const { id } = await params;

    const attendance = await service.getById(id);

    if (!attendance) {
      return NextResponse.json(
        { error: 'Présence non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: attendance });
  } catch (error: any) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hr/attendance/[id] - Mettre à jour
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_UPDATE);
    const { id } = await params;
    const body = await request.json();

    const attendance = await service.update(id, body);

    return NextResponse.json({ data: attendance });
  } catch (error: any) {
    console.error('Error updating attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hr/attendance/[id] - Supprimer
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_DELETE);
    const { id } = await params;

    await service.delete(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
