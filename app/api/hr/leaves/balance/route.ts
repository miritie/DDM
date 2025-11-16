/**
 * API Route - Solde Congés
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { LeaveService } from '@/lib/modules/hr/leave-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LeaveService();

/**
 * GET /api/hr/leaves/balance - Obtenir le solde de congés d'un employé
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const year = searchParams.get('year');

    if (!employeeId) {
      return NextResponse.json(
        { error: 'EmployeeId requis' },
        { status: 400 }
      );
    }

    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    const balance = await service.getBalance(employeeId, yearNum);

    return NextResponse.json({ data: balance });
  } catch (error: any) {
    console.error('Error fetching leave balance:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}
