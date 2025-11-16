/**
 * API Routes - Gestion des Rôles
 * Module Administration & Settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { RoleService } from '@/lib/modules/admin/role-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new RoleService();

/**
 * GET /api/admin/roles - Liste des rôles
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_ROLES_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const roles = await service.list(workspaceId, filters);

    return NextResponse.json({ data: roles });
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/admin/roles - Création de rôle
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_ROLES_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    // Créer le rôle
    const role = await service.create({
      name: body.name,
      description: body.description,
      permissionIds: body.permissionIds || [],
      workspaceId,
    });

    // Assigner les permissions via la table role_permissions
    if (body.permissionIds && body.permissionIds.length > 0) {
      await service.assignPermissions(role.id, body.permissionIds);
    }

    return NextResponse.json({ data: role }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
