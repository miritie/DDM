/**
 * API Routes - Liste des Permissions
 * Module Administration & Settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { RoleService } from '@/lib/modules/admin/role-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new RoleService();

/**
 * GET /api/admin/roles/permissions - Liste toutes les permissions disponibles
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_ROLES_VIEW);

    const permissions = await service.listPermissions();

    return NextResponse.json({ data: permissions });
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
