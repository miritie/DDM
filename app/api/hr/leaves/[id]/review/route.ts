/**
 * API Route - Validation Congé
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { LeaveService } from '@/lib/modules/hr/leave-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LeaveService();

/**
 * POST /api/hr/leaves/[id]/review - Approuver/Rejeter un congé
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_APPROVE);
    const { id } = await params;
    const body = await request.json();

    const leave = await service.review({
      leaveId: id,
      status: body.status,
      reviewNotes: body.reviewNotes,
      reviewedById: body.reviewedById,
    });

    return NextResponse.json({ data: leave });
  } catch (error: any) {
    console.error('Error reviewing leave:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la validation' },
      { status: 500 }
    );
  }
}
