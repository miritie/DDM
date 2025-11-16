/**
 * API Routes - Employés
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { EmployeeService } from '@/lib/modules/hr/employee-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new EmployeeService();

/**
 * GET /api/hr/employees - Liste des employés
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('department')) {
      filters.department = searchParams.get('department');
    }
    if (searchParams.get('contractType')) {
      filters.contractType = searchParams.get('contractType');
    }

    const employees = await service.list(workspaceId, filters);

    return NextResponse.json({ data: employees });
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/hr/employees - Créer un employé
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const employee = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
