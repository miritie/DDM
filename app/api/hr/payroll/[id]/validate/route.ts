/**
 * API Route - Validation Paie
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { PayrollService } from '@/lib/modules/hr/payroll-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new PayrollService();

/**
 * POST /api/hr/payroll/[id]/validate - Valider une paie
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_APPROVE);
    const { id } = await params;

    const payroll = await service.validate(id);

    return NextResponse.json({ data: payroll });
  } catch (error: any) {
    console.error('Error validating payroll:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la validation' },
      { status: 500 }
    );
  }
}
