/**
 * API Routes - Gestion d'un Rôle Spécifique
 * Module Administration & Settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { RoleService } from '@/lib/modules/admin/role-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserUuid } from '@/lib/auth/get-session';

const service = new RoleService();

/**
 * GET /api/admin/roles/[roleId] - Récupérer un rôle spécifique
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_ROLES_VIEW);

    const { roleId } = await params;
    const role = await service.getById(roleId);

    if (!role) {
      return NextResponse.json(
        { error: 'Rôle introuvable' },
        { status: 404 }
      );
    }

    // Récupérer les permissions associées via la table role_permissions
    const permissions = await service.getRolePermissions((role as any).id);

    return NextResponse.json({
      data: {
        ...role,
        permissions,
      },
    });
  } catch (error: any) {
    console.error('Error fetching role:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * PUT /api/admin/roles/[roleId] - Mettre à jour un rôle
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_ROLES_EDIT);

    const { roleId } = await params;
    const body = await request.json();

    // Récupérer le rôle existant pour obtenir son UUID
    const existingRole = await service.getById(roleId);
    if (!existingRole) {
      return NextResponse.json(
        { error: 'Rôle introuvable' },
        { status: 404 }
      );
    }

    // Mettre à jour le rôle
    const role = await service.update(roleId, {
      name: body.name,
      description: body.description,
      permissionIds: body.permissionIds,
      isActive: body.isActive,
    });

    // Mettre à jour les permissions via la table role_permissions.
    // Le service calcule le delta réel (ajouts / retraits) et journalise
    // dans role_permissions_audit. On renvoie le delta au client pour
    // affichage post-save / debug.
    let diff: { added: string[]; removed: string[] } | null = null;
    if (body.permissionIds !== undefined) {
      const changedBy = await getCurrentUserUuid();
      diff = await service.assignPermissions(
        (existingRole as any).id,
        body.permissionIds || [],
        changedBy,
        'admin-ui',
      );
    }

    return NextResponse.json({ data: role, diff });
  } catch (error: any) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * DELETE /api/admin/roles/[roleId] - Supprimer un rôle
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_ROLES_DELETE);

    const { roleId } = await params;
    await service.delete(roleId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
