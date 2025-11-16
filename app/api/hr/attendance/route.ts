/**
 * API Routes - Présences
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AttendanceService } from '@/lib/modules/hr/attendance-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new AttendanceService();

/**
 * GET /api/hr/attendance - Liste des présences
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
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('startDate')) {
      filters.startDate = searchParams.get('startDate');
    }
    if (searchParams.get('endDate')) {
      filters.endDate = searchParams.get('endDate');
    }

    const attendances = await service.list(workspaceId, filters);

    return NextResponse.json({ data: attendances });
  } catch (error: any) {
    console.error('Error fetching attendances:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/hr/attendance - Créer une présence
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const attendance = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: attendance }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating attendance:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
