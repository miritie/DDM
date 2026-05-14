/**
 * API Route - Calcul du coût d'une recette
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
    // Coût détaillé = secret de fabrication → PCA + admin uniquement
    await requirePermission(PERMISSIONS.RECIPE_VIEW_FORMULA);
    const { id } = await params;
    const cost = await service.calculateCost(id);
    return NextResponse.json({ data: cost });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
