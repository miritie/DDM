/**
 * API Routes - Employés - Opérations par ID
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { EmployeeService } from '@/lib/modules/hr/employee-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new EmployeeService();

/**
 * GET /api/hr/employees/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const { id } = await params;

    const employee = await service.getById(id);

    if (!employee) {
      return NextResponse.json(
        { error: 'Employé non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: employee });
  } catch (error: any) {
    console.error('Error fetching employee:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hr/employees/[id] - Mettre à jour
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_UPDATE);
    const { id } = await params;
    const body = await request.json();

    const employee = await service.update(id, body);

    return NextResponse.json({ data: employee });
  } catch (error: any) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hr/employees/[id] - Terminer le contrat
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.HR_DELETE);
    const { id } = await params;
    const body = await request.json();

    const employee = await service.terminate(
      id,
      body.terminationDate,
      body.terminationReason
    );

    return NextResponse.json({ data: employee });
  } catch (error: any) {
    console.error('Error terminating employee:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la résiliation' },
      { status: 500 }
    );
  }
}
