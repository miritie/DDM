/**
 * API - Catégorie de produits par ID (édition + suppression)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductCategoryService } from '@/lib/modules/admin/product-category-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ProductCategoryService();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const { id } = await params;
    const body = await request.json();
    const data = await service.update(id, body);
    return NextResponse.json({ data });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Une catégorie avec ce nom existe déjà' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const { id } = await params;
    const result = await service.delete(id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
