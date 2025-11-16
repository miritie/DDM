/**
 * API Routes - Gestion des Utilisateurs
 * Module Administration & Settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { UserService } from '@/lib/modules/admin/user-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new UserService();

/**
 * GET /api/admin/users - Liste des utilisateurs
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_USERS_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('roleId')) {
      filters.roleId = searchParams.get('roleId');
    }
    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const users = await service.list(workspaceId, filters);

    return NextResponse.json({ data: users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/admin/users - Création d'utilisateur
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_USERS_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const user = await service.create({
      ...body,
      workspaceId,
    });

    // Ne pas retourner le hash du mot de passe
    const { PasswordHash, ...userWithoutPassword } = user as any;

    return NextResponse.json({ data: userWithoutPassword }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
