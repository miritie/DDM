/**
 * API Routes - Produits - Opérations par ID
 * Module Ventes & Encaissements
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/lib/modules/sales/product-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ProductService();

/**
 * GET /api/products/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id } = await params;

    const product = await service.getById(id);

    if (!product) {
      return NextResponse.json(
        { error: 'Produit non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: product });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/products/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);
    const { id } = await params;
    const body = await request.json();

    const product = await service.update(id, body);

    return NextResponse.json({ data: product });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}
