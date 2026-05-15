/**
 * GET /api/production/ingredients/adjustments
 *
 * Historique des ajustements de stock d'ingrédients. Optionnel:
 *   ?ingredientId=<id> pour filtrer par ingrédient.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { IngredientAdjustmentService } from '@/lib/modules/production/ingredient-adjustment-service';

const service = new IngredientAdjustmentService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.INGREDIENT_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const data = await service.list(workspaceId, {
      ingredientId: searchParams.get('ingredientId') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
