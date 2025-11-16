/**
 * API Routes - Opérations sur Utilisateur
 * Module Administration & Settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/modules/admin/user-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new UserService();

/**
 * GET /api/admin/users/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_USERS_VIEW);
    const { id } = await params;

    const user = await service.getById(id);

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Ne pas retourner le hash du mot de passe
    const { PasswordHash, ...userWithoutPassword } = user as any;

    return NextResponse.json({ data: userWithoutPassword });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_USERS_EDIT);
    const { id } = await params;
    const body = await request.json();

    const user = await service.update(id, body);

    // Ne pas retourner le hash du mot de passe
    const { PasswordHash, ...userWithoutPassword } = user as any;

    return NextResponse.json({ data: userWithoutPassword });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_USERS_DELETE);
    const { id } = await params;

    await service.delete(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
