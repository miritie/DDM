/**
 * API Routes - Produits
 * Module Ventes & Encaissements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ProductService } from '@/lib/modules/sales/product-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ProductService();

/**
 * GET /api/products - Liste des produits
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }
    if (searchParams.get('category')) {
      filters.category = searchParams.get('category');
    }

    const search = searchParams.get('search');
    let products;

    if (search) {
      products = await service.search(workspaceId, search);
    } else {
      products = await service.list(workspaceId, filters);
    }

    return NextResponse.json({ data: products });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/products - Création d'un produit
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const product = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
