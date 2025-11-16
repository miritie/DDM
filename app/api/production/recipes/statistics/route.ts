/**
 * API Route - Statistiques des recettes
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

    const statistics = await service.getStatistics(workspaceId);
    return NextResponse.json({ data: statistics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
