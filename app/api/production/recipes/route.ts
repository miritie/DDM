/**
 * API Route - Recettes / BOM (Bill of Materials)
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { RecipeService } from '@/lib/modules/production/recipe-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new RecipeService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const isActive = searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined;
    const productId = searchParams.get('productId') || undefined;

    const recipes = await service.list(workspaceId, { isActive, productId });
    return NextResponse.json({ data: recipes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const recipe = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: recipe }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
