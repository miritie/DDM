/**
 * API Routes - Congés
 * Module Ressources Humaines
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { LeaveService } from '@/lib/modules/hr/leave-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LeaveService();

/**
 * GET /api/hr/leaves - Liste des congés
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
    if (searchParams.get('type')) {
      filters.type = searchParams.get('type');
    }

    const leaves = await service.list(workspaceId, filters);

    return NextResponse.json({ data: leaves });
  } catch (error: any) {
    console.error('Error fetching leaves:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/hr/leaves - Créer une demande de congé
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const leave = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: leave }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating leave:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
