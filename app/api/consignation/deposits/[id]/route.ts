/**
 * API Route - Détail et modification d'un dépôt
 * GET /api/consignation/deposits/[id] - Détails du dépôt
 * PATCH /api/consignation/deposits/[id] - Modifier le dépôt
 */

import { NextRequest, NextResponse } from 'next/server';
import { DepositService } from '@/lib/modules/consignation/deposit-service';
import { getWorkspaceId } from '@/lib/auth/workspace';

const depositService = new DepositService();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const deposit = await depositService.getById(params.id);

    if (!deposit) {
      return NextResponse.json({ error: 'Dépôt non trouvé' }, { status: 404 });
    }

    if (deposit.WorkspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: deposit,
    });
  } catch (error: any) {
    console.error('Erreur récupération dépôt:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const existing = await depositService.getById(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Dépôt non trouvé' }, { status: 404 });
    }

    if (existing.WorkspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const updated = await depositService.update(params.id, body);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Dépôt mis à jour avec succès',
    });
  } catch (error: any) {
    console.error('Erreur mise à jour dépôt:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
