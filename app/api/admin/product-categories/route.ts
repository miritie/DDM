/**
 * API - Catégories de produits (liste + création)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ProductCategoryService } from '@/lib/modules/admin/product-category-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ProductCategoryService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const data = await service.list(workspaceId, includeInactive);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }

    const data = await service.create({
      name: body.name,
      color: body.color,
      sortOrder: body.sortOrder,
      workspaceId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Une catégorie avec ce nom existe déjà' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
