/**
 * API Routes - Gestion d'un Workspace
 * Module Administration & Settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '@/lib/modules/admin/workspace-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new WorkspaceService();

/**
 * GET /api/admin/workspaces/[id] - Récupère un workspace par ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_VIEW);

    const { id } = await params;
    const workspace = await service.getById(id);

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ data: workspace });
  } catch (error: any) {
    console.error('Error fetching workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * PUT /api/admin/workspaces/[id] - Met à jour un workspace
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);

    const { id } = await params;
    const body = await request.json();

    const workspace = await service.update(id, body);

    return NextResponse.json({ data: workspace });
  } catch (error: any) {
    console.error('Error updating workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * DELETE /api/admin/workspaces/[id] - Désactive un workspace
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);

    const { id } = await params;
    await service.deactivate(id);

    return NextResponse.json({ message: 'Workspace désactivé avec succès' });
  } catch (error: any) {
    console.error('Error deleting workspace:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
