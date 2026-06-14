/**
 * API Route - Outbox comptable (régularisation des écritures en attente)
 *
 * GET  /api/accounting/outbox   → { pending: n }
 *   Nombre d'écritures comptables restant à produire (ventes, paiements,
 *   dépenses, paies dont la génération immédiate avait échoué).
 *
 * POST /api/accounting/outbox   → { done, failed, remaining }
 *   Rejoue toutes les écritures en attente du workspace. Idempotent
 *   (génération par référence) — sûr à relancer autant de fois que voulu.
 */

import { NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { AccountingOutboxService } from '@/lib/modules/accounting/accounting-outbox-service';
import { handleApiError } from '@/lib/http/api-error';

const outbox = new AccountingOutboxService();

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);
    const ws = await getCurrentWorkspaceId();
    return NextResponse.json({ data: { pending: await outbox.pendingCount(ws) } });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement des écritures en attente');
  }
}

export async function POST() {
  try {
    await requirePermission(PERMISSIONS.TREASURY_CREATE);
    const ws = await getCurrentWorkspaceId();
    const result = await outbox.process({ workspaceId: ws });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, 'Erreur lors de la régularisation comptable');
  }
}
