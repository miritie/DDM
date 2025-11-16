/**
 * API Routes - Gestion des Workspaces
 * Module Administration & Settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/modules/admin/workspace-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new WorkspaceService();

/**
 * GET /api/admin/workspaces - Liste des workspaces
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_VIEW);

    const { searchParams } = new URL(request.url);
    const filters: any = {};

    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const workspaces = await service.list(filters);

    return NextResponse.json({ data: workspaces });
  } catch (error: any) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/admin/workspaces - Création de workspace
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);

    const body = await request.json();
    const workspace = await service.create(body);

    return NextResponse.json({ data: workspace }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
