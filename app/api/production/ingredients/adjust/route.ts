/**
 * POST /api/production/ingredients/adjust
 *
 * Ajuste le stock physique d'un ingrédient (inventaire). Body:
 *   { ingredientId, countedStock, reason? }
 * Le processedById vient de la session.
 *
 * Permission : INGREDIENT_EDIT (manager_production + manager_compta_stocks).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { IngredientAdjustmentService } from '@/lib/modules/production/ingredient-adjustment-service';

const service = new IngredientAdjustmentService();

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.INGREDIENT_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const processedById = await getCurrentUserId();
    const body = await request.json();

    if (!body?.ingredientId) {
      return NextResponse.json({ error: 'ingredientId requis' }, { status: 400 });
    }
    if (typeof body.countedStock !== 'number' || body.countedStock < 0) {
      return NextResponse.json({ error: 'countedStock doit être un nombre positif' }, { status: 400 });
    }

    const result = await service.adjust({
      workspaceId,
      ingredientId: body.ingredientId,
      countedStock: body.countedStock,
      reason: body.reason || undefined,
      processedById,
    });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
