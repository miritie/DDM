/**
 * API - Images additionnelles d'un produit (carrousel POS).
 *
 * POST   /api/products/{id}/images       body { url, position? } → ajoute
 * DELETE /api/products/{id}/images?id=X  → retire une image
 *
 * {id} accepte l'UUID PK ou le business code (PRD-…).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/lib/modules/sales/product-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ProductService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);
    const { id } = await params;
    const body = await request.json();
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json({ error: 'url manquante' }, { status: 400 });
    }
    const image = await service.addImage(id, body.url, body.position);
    return NextResponse.json({ data: image }, { status: 201 });
  } catch (error: any) {
    console.error('addImage error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('id');
    if (!imageId) {
      return NextResponse.json({ error: 'Query param id manquant' }, { status: 400 });
    }
    await service.removeImage(imageId);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('removeImage error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
