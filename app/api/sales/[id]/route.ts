/**
 * API Routes - Ventes - Opérations par ID
 * Module Ventes & Encaissements
 */

import { NextRequest, NextResponse } from 'next/server';
import { SaleService } from '@/lib/modules/sales/sale-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new SaleService();

/**
 * GET /api/sales/[id] - Détails d'une vente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id } = await params;

    const sale = await service.getById(id);

    if (!sale) {
      return NextResponse.json(
        { error: 'Vente non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: sale });
  } catch (error: any) {
    console.error('Error fetching sale:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sales/[id] - Mise à jour d'une vente
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);
    const { id } = await params;
    const body = await request.json();

    const sale = await service.update(id, body);

    return NextResponse.json({ data: sale });
  } catch (error: any) {
    console.error('Error updating sale:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sales/[id] - Annulation d'une vente
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_DELETE);
    const { id } = await params;

    await service.cancel(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling sale:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
