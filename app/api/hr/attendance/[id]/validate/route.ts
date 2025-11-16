/**
 * API Route - Validation Présence
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { AttendanceService } from '@/lib/modules/hr/attendance-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AttendanceService();

/**
 * POST /api/hr/attendance/[id]/validate - Valider une présence
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_APPROVE);
    const { id } = await params;
    const body = await request.json();

    const attendance = await service.validate({
      attendanceId: id,
      validatedById: body.validatedById,
    });

    return NextResponse.json({ data: attendance });
  } catch (error: any) {
    console.error('Error validating attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la validation' },
      { status: 500 }
    );
  }
}
