/**
 * API Routes - Liste des Permissions
 * Module Administration & Settings
 */

import { NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

/**
 * GET /api/admin/permissions - Liste toutes les permissions
 */
export async function GET() {
  try {
    await requirePermission(PERMISSIONS.ADMIN_ROLES_VIEW);

    const db = getPostgresClient();

    const result = await db.query(
      `SELECT
        id,
        permission_id as "PermissionId",
        code as "Code",
        name as "Name",
        description as "Description",
        module as "Module",
        is_active as "IsActive"
      FROM permissions
      WHERE is_active = true
      ORDER BY module, name`
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
