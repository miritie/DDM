/**
 * API Route - Statistiques des ingrédients
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

    const statistics = await service.getStatistics(workspaceId);
    return NextResponse.json({ data: statistics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
