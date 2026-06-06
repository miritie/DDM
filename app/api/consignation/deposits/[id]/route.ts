/**
 * API Route - Détail et modification d'un dépôt
 * GET /api/consignation/deposits/[id] - Détails du dépôt
 * PATCH /api/consignation/deposits/[id] - Modifier le dépôt
 */

import { NextRequest, NextResponse } from 'next/server';
import { DepositService } from '@/lib/modules/consignation/deposit-service';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError } from '@/lib/http/api-error';

const depositService = new DepositService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CONSIGNMENT_VIEW);
    const { id } = await params;
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const deposit = await depositService.getById(id);

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
  } catch (error) {
    return handleApiError(error, 'Erreur serveur');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CONSIGNMENT_EDIT);
    const { id } = await params;
    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const existing = await depositService.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Dépôt non trouvé' }, { status: 404 });
    }

    if (existing.WorkspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const updated = await depositService.update(id, body);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Dépôt mis à jour avec succès',
    });
  } catch (error) {
    return handleApiError(error, 'Erreur serveur');
  }
}
