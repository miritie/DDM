/**
 * API Routes - Moyens de paiement (liste + création)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { PaymentMethodService } from '@/lib/modules/treasury/payment-method-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new PaymentMethodService();

/**
 * GET /api/treasury/payment-methods — liste (filtre ?isActive=true/false)
 *
 * Pas de permission spécifique : la liste des moyens de paiement est une
 * table de référence consultée par toutes les pages affichant un paiement
 * (ventes, dépenses, paie, profil client). L'auth utilisateur est garantie
 * par le middleware. La permission `PAYMENT_METHOD_EDIT` reste exigée pour
 * créer / modifier / activer / désactiver.
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: { isActive?: boolean } = {};
    const isActiveParam = searchParams.get('isActive');
    if (isActiveParam !== null) filters.isActive = isActiveParam === 'true';

    const rows = await service.list(workspaceId, filters);
    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/** POST /api/treasury/payment-methods — créer un moyen personnalisé */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.PAYMENT_METHOD_EDIT);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    if (!body.code || !body.label) {
      return NextResponse.json(
        { error: 'Les champs "code" et "label" sont obligatoires.' },
        { status: 400 }
      );
    }

    const created = await service.create({
      code: body.code,
      label: body.label,
      requiredWalletType: body.requiredWalletType ?? null,
      displayOrder: body.displayOrder,
      icon: body.icon ?? null,
      workspaceId,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payment method:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
