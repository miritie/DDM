/**
 * API Route - Avances au personnel (dette interne)
 *
 * GET  /api/hr/advances[?status=open]   → liste des avances
 * POST /api/hr/advances { employeeId, amount, walletId, reason? }
 *   Octroie et verse une avance immédiatement (débit caisse + écriture
 *   D 425 / C 5xx). Récupérée automatiquement au prochain bulletin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';
import { StaffAdvanceService } from '@/lib/modules/hr/staff-advance-service';
import { handleApiError, ValidationError } from '@/lib/http/api-error';

const service = new StaffAdvanceService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const ws = await getCurrentWorkspaceId();
    const status = request.nextUrl.searchParams.get('status') || undefined;
    return NextResponse.json({ data: await service.list(ws, { status }) });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement des avances');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.HR_CREATE);
    const ws = await getCurrentWorkspaceId();
    const grantedById = await getCurrentUserId();
    const body = await request.json().catch(() => ({}));
    if (!body.employeeId) throw new ValidationError('Employé requis');
    if (!body.walletId) throw new ValidationError('Caisse / banque requise');
    if (!(Number(body.amount) > 0)) throw new ValidationError('Montant invalide');

    const advance = await service.grant({
      workspaceId: ws,
      employeeId: body.employeeId,
      amount: Number(body.amount),
      walletId: body.walletId,
      reason: body.reason,
      grantedById,
    });
    return NextResponse.json({ data: advance }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Erreur lors de l'octroi de l'avance");
  }
}
