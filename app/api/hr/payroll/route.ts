/**
 * API Routes - Paie
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { PayrollService } from '@/lib/modules/hr/payroll-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new PayrollService();

/**
 * GET /api/hr/payroll - Liste des paies
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('employeeId')) {
      filters.employeeId = searchParams.get('employeeId');
    }
    if (searchParams.get('period')) {
      filters.period = searchParams.get('period');
    }
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }

    const payrolls = await service.list(workspaceId, filters);

    return NextResponse.json({ data: payrolls });
  } catch (error: any) {
    console.error('Error fetching payrolls:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/hr/payroll - Créer une paie
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const payroll = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: payroll }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payroll:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
