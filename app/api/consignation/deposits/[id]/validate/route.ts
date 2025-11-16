/**
 * API Route - Valider un dépôt
 * POST /api/consignation/deposits/[id]/validate - Valider et déclencher sortie stock
 */

import { NextRequest, NextResponse } from 'next/server';
import { DepositService } from '@/lib/modules/consignation/deposit-service';
import { getWorkspaceId } from '@/lib/auth/workspace';

const depositService = new DepositService();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
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

    const deposit = await depositService.validate(params.id, validatorId);

    return NextResponse.json({
      success: true,
      data: deposit,
      message: 'Dépôt validé avec succès. Sortie de stock effectuée.',
    });
  } catch (error: any) {
    console.error('Erreur validation dépôt:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
