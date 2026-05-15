/**
 * API Routes - Catégories de Dépenses
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserRoleIds } from '@/lib/auth/get-session';
import { ExpenseCategoryService } from '@/lib/modules/expenses/expense-category-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { cachedJson } from '@/lib/http/cache-headers';

const service = new ExpenseCategoryService();

/**
 * GET /api/expenses/categories
 *
 * Query params :
 *   - isActive=true/false : filtre par statut actif
 *   - accessibleFor=me    : ne retourne que les catégories accessibles à
 *                           l'utilisateur courant selon ses rôles (à utiliser
 *                           dans les formulaires de demande de dépense)
 *
 * Sans accessibleFor=me, retourne toutes les catégories du workspace
 * (utilisé par la page admin pour gestion).
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    if (searchParams.get('accessibleFor') === 'me') {
      const userRoleIds = await getCurrentUserRoleIds();
      const onlyActive = searchParams.get('isActive') !== 'false';
      const data = await service.listAccessibleForUser(workspaceId, userRoleIds, { onlyActive });
      return cachedJson(data, 'reference');
    }

    const filters: any = {};
    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const categories = await service.list(workspaceId, filters);

    return cachedJson(categories, 'reference');
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/expenses/categories - Créer une catégorie
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const category = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
