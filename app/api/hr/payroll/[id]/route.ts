/**
 * API Routes - Paie - Opérations par ID
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { PayrollService } from '@/lib/modules/hr/payroll-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new PayrollService();

/**
 * GET /api/hr/payroll/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const { id } = await params;

    const payroll = await service.getById(id);

    if (!payroll) {
      return NextResponse.json(
        { error: 'Paie non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: payroll });
  } catch (error: any) {
    console.error('Error fetching payroll:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hr/payroll/[id] - Annuler
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
    console.error('Error cancelling payroll:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
