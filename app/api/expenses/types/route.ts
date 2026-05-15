/**
 * GET  /api/expenses/types — liste des types
 *   ?categoryId=…       filtre par catégorie
 *   ?isActive=true/false
 *   ?accessibleFor=me   filtre selon les rôles de la session (cascade type→catégorie)
 *
 * POST /api/expenses/types — création
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserRoleIds } from '@/lib/auth/get-session';
import { ExpenseTypeService } from '@/lib/modules/expenses/expense-type-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { cachedJson } from '@/lib/http/cache-headers';

const service = new ExpenseTypeService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    if (searchParams.get('accessibleFor') === 'me') {
      const userRoleIds = await getCurrentUserRoleIds();
      const data = await service.listAccessibleForUser(workspaceId, userRoleIds);
      return cachedJson(data, 'reference');
    }

    const data = await service.list(workspaceId, {
      categoryId: searchParams.get('categoryId') || undefined,
      isActive: searchParams.get('isActive') === null ? undefined : searchParams.get('isActive') === 'true',
    });
    return cachedJson(data, 'reference');
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_APPROVE);  // admin + comptable
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    const data = await service.create({ ...body, workspaceId });
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
