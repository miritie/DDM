/**
 * API Route - Lignes de recette
 *
 * POST   /api/production/recipes/[id]/lines          → ajoute une ligne
 * PATCH  /api/production/recipes/[id]/lines?lineId=X → modifie la ligne X
 * DELETE /api/production/recipes/[id]/lines?lineId=X → supprime la ligne X
 *
 * Permission : recipe:edit (PCA + admin uniquement).
 */
import { NextRequest, NextResponse } from 'next/server';
import { RecipeService } from '@/lib/modules/production/recipe-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new RecipeService();

export async function POST(
  request: NextRequest,
  _: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.RECIPE_EDIT);
    const { id } = await _.params;
    const body = await request.json();
    const line = await service.addLine(id, body);
    return NextResponse.json({ data: line }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.RECIPE_EDIT);
    const url = new URL(request.url);
    const lineId = url.searchParams.get('lineId');
    if (!lineId) return NextResponse.json({ error: 'lineId requis' }, { status: 400 });
    const body = await request.json();
    const data = await service.updateLine(lineId, body);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.RECIPE_EDIT);
    const url = new URL(request.url);
    const lineId = url.searchParams.get('lineId');
    if (!lineId) return NextResponse.json({ error: 'lineId requis' }, { status: 400 });
    await service.deleteLine(lineId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
