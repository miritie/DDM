/**
 * API Route - Ingrédients / Matières Premières
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { IngredientService } from '@/lib/modules/production/ingredient-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new IngredientService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const isActive = searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined;
    const belowMinimum = searchParams.get('belowMinimum') === 'true' ? true : undefined;

    const ingredients = await service.list(workspaceId, { isActive, belowMinimum });
    return NextResponse.json({ data: ingredients });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const ingredient = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: ingredient }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
