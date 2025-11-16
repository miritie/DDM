/**
 * API Route - Lignes de recette
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { RecipeService } from '@/lib/modules/production/recipe-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new RecipeService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const { id } = await params;
    const body = await request.json();

    const line = await service.addLine(id, body);
    return NextResponse.json({ data: line }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
