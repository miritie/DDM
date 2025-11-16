/**
 * API Routes - Catégories de Dépenses
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ExpenseCategoryService } from '@/lib/modules/expenses/expense-category-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseCategoryService();

/**
 * GET /api/expenses/categories - Liste des catégories
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const categories = await service.list(workspaceId, filters);

    return NextResponse.json({ data: categories });
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
