/**
 * API Route - Valider un dépôt
 * POST /api/consignation/deposits/[id]/validate - Valider et déclencher sortie stock
 */

import { NextRequest, NextResponse } from 'next/server';
import { DepositService } from '@/lib/modules/consignation/deposit-service';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError } from '@/lib/http/api-error';

const depositService = new DepositService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CONSIGNMENT_VALIDATE);
    const { id } = await params;
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { validatorId, validatorName } = body;

    if (!validatorId || !validatorName) {
      return NextResponse.json(
        { error: 'Validateur requis' },
        { status: 400 }
      );
    }

    const deposit = await depositService.validate(id, validatorId, validatorName);

    return NextResponse.json({
      success: true,
      data: deposit,
      message: 'Dépôt validé avec succès. Sortie de stock effectuée.',
    });
  } catch (error) {
    return handleApiError(error, 'Erreur serveur');
  }
}
