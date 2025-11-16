/**
 * API Routes - Catégories de Dépenses - Opérations par ID
 * Module Dépenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExpenseCategoryService } from '@/lib/modules/expenses/expense-category-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ExpenseCategoryService();

/**
 * GET /api/expenses/categories/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { id } = await params;

    const category = await service.getById(id);

    if (!category) {
      return NextResponse.json(
        { error: 'Catégorie non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: category });
  } catch (error: any) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/expenses/categories/[id] - Mettre à jour
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_EDIT);
    const { id } = await params;
    const body = await request.json();

    const category = await service.update(id, body);

    return NextResponse.json({ data: category });
  } catch (error: any) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/expenses/categories/[id] - Supprimer
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_DELETE);
    const { id } = await params;

    await service.delete(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
