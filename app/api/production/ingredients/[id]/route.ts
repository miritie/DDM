/**
 * API Route - Ingrédient individuel
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { IngredientService } from '@/lib/modules/production/ingredient-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new IngredientService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_VIEW);
    const { id } = await params;
    const ingredient = await service.getById(id);

    if (!ingredient) {
      return NextResponse.json({ error: 'Ingrédient non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ data: ingredient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const { id } = await params;
    const body = await request.json();

    const ingredient = await service.update(id, body);
    return NextResponse.json({ data: ingredient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
