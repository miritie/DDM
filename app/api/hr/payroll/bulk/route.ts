/**
 * API Route - Génération en masse de paies
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { PayrollService } from '@/lib/modules/hr/payroll-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new PayrollService();

/**
 * POST /api/hr/payroll/bulk - Générer les paies pour tous les employés actifs
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const payrolls = await service.generateBulkPayroll(
      workspaceId,
      body.period,
      body.employeeIds
    );

    return NextResponse.json({ data: payrolls }, { status: 201 });
  } catch (error: any) {
    console.error('Error generating bulk payroll:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération en masse' },
      { status: 500 }
    );
  }
}
