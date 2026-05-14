/**
 * API Routes - Moyens de paiement (par ID)
 *
 * Le paramètre [id] est le code métier `payment_method_id` (dual-id DDM),
 * conformément à la convention du projet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new PaymentMethodService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PAYMENT_METHOD_VIEW);
    const { id } = await params;
    const pm = await service.getByBusinessId(id);
    if (!pm) {
      return NextResponse.json({ error: 'Moyen de paiement introuvable' }, { status: 404 });
    }
    return NextResponse.json({ data: pm });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * PATCH /api/treasury/payment-methods/[id]
 * Actions :
 *  - { isActive: boolean } → activate / deactivate
 *  - { label, requiredWalletType, displayOrder, icon } → édition métadonnées
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.PAYMENT_METHOD_EDIT);
    const { id } = await params;
    const body = await request.json();

    if (typeof body.isActive === 'boolean') {
      const updated = body.isActive
        ? await service.activate(id)
        : await service.deactivate(id);
      return NextResponse.json({ data: updated });
    }

    const updated = await service.update(id, {
      label: body.label,
      requiredWalletType: body.requiredWalletType,
      displayOrder: body.displayOrder,
      icon: body.icon,
    });
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
