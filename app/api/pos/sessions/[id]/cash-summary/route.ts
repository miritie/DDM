/**
 * GET /api/pos/sessions/{id}/cash-summary
 *
 * Renvoie le cash attendu d'une session POS — calcul faisant autorité,
 * indépendant du solde cumulé du wallet caisse :
 *
 *   cash_in  = ventes cash de la session (sale_payments.method=cash)
 *   cash_out = dépôts caisse faits durant la session
 *   expected = cash_in − cash_out
 *
 * Permission : cash:deposit:create (= permission de fermeture de caisse).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { PosSessionService } from '@/lib/modules/outlets/pos-session-service';

const posSessionService = new PosSessionService();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CASH_DEPOSIT_CREATE);
    const { id } = await params;
    const summary = await posSessionService.getSessionCashSummary(id);
    return NextResponse.json({ data: summary });
  } catch (e: any) {
    console.error('cash-summary error:', e);
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
