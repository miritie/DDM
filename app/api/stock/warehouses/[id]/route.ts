/**
 * API Routes - Entrepôt par ID
 *
 * GET   /api/stock/warehouses/[id]  → détail entrepôt
 * PUT   /api/stock/warehouses/[id]  → mise à jour (nom, flags, etc.)
 *
 * Le [id] est le business id (warehouse_id) — pas l'UUID interne.
 */

import { NextRequest, NextResponse } from 'next/server';
import { WarehouseService } from '@/lib/modules/stock/warehouse-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new WarehouseService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.STOCK_VIEW);
    const { id } = await params;
    const w = await service.getById(id);
    if (!w) return NextResponse.json({ error: 'Entrepôt non trouvé' }, { status: 404 });
    return NextResponse.json({ data: w });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Mêmes permissions que la création d'entrepôt — on modifie un
    // attribut structurel de niveau admin (flag « source production »
    // notamment).
    await requirePermission(PERMISSIONS.STOCK_CREATE);
    const { id } = await params;
    const body = await request.json();

    const updated = await service.update(id, {
      name: body.name,
      location: body.location,
      address: body.address,
      managerId: body.managerId,
      isActive: body.isActive,
      isProductionSource: body.isProductionSource,
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error('Error updating warehouse:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
