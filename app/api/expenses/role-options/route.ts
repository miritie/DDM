/**
 * GET /api/expenses/role-options
 *
 * Liste légère des rôles actifs du workspace pour le picker
 * "Rôles autorisés" sur les catégories de dépense. Accessible aux
 * utilisateurs ayant EXPENSE_APPROVE (admin + comptable typiquement),
 * sans exiger ADMIN_ROLES_VIEW qui est plus restrictif.
 */

import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);
    const workspaceId = await getCurrentWorkspaceId();
    const r = await db.query<any>(
      `SELECT id, role_id, name
       FROM roles
       WHERE workspace_id = $1 AND is_active = true
       ORDER BY name ASC`,
      [workspaceId]
    );
    return NextResponse.json({ data: r.rows });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
