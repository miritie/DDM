/**
 * API Route - Recherche Employés
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { EmployeeService } from '@/lib/modules/hr/employee-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new EmployeeService();

/**
 * GET /api/hr/employees/search
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const employees = await service.search(workspaceId, query);

    return NextResponse.json({ data: employees });
  } catch (error: any) {
    console.error('Error searching employees:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la recherche' },
      { status: 500 }
    );
  }
}
