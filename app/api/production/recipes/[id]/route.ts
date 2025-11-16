/**
 * API Route - Recette individuelle
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { RecipeService } from '@/lib/modules/production/recipe-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new RecipeService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_VIEW);
    const { id } = await params;
    const recipe = await service.getById(id);

    if (!recipe) {
      return NextResponse.json({ error: 'Recette non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ data: recipe });
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

    const recipe = await service.update(id, body);
    return NextResponse.json({ data: recipe });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
