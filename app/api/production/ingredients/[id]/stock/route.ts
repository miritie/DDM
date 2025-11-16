/**
 * API Route - Gestion du stock des ingrédients
 * Module Production & Usine
 */

import { NextRequest, NextResponse } from 'next/server';
import { IngredientService } from '@/lib/modules/production/ingredient-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new IngredientService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PRODUCTION_EDIT);
    const { id } = await params;
    const body = await request.json();

    const { operation, quantity, unitCost } = body;

    if (!operation || !quantity) {
      return NextResponse.json(
        { error: 'Operation et quantity sont requis' },
        { status: 400 }
      );
    }

    let ingredient;

    if (operation === 'increase') {
      ingredient = await service.increaseStock(id, quantity, unitCost);
    } else if (operation === 'decrease') {
      ingredient = await service.decreaseStock(id, quantity);
    } else {
      return NextResponse.json(
        { error: 'Operation doit être "increase" ou "decrease"' },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: ingredient });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
