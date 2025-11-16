/**
 * API Routes - Entrepôts
 * Module Stocks & Mouvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { WarehouseService } from '@/lib/modules/stock/warehouse-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new WarehouseService();

/**
 * GET /api/stock/warehouses - Liste des entrepôts
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('isActive')) {
      filters.isActive = searchParams.get('isActive') === 'true';
    }

    const warehouses = await service.list(workspaceId, filters);

    return NextResponse.json({ data: warehouses });
  } catch (error: any) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/stock/warehouses - Créer un entrepôt
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.STOCK_CREATE);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const warehouse = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: warehouse }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating warehouse:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
