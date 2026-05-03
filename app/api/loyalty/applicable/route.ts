/**
 * GET /api/loyalty/applicable?clientId=&cartTotal=&itemCount=
 * Retourne la règle prioritaire applicable + montant de remise (ou null).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { LoyaltyEngine } from '@/lib/modules/loyalty/loyalty-engine';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const engine = new LoyaltyEngine();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const clientId = searchParams.get('clientId');
    const cartTotal = parseFloat(searchParams.get('cartTotal') || '0');
    const itemCount = parseInt(searchParams.get('itemCount') || '0', 10);

    if (!clientId || cartTotal <= 0) {
      return NextResponse.json({ data: null });
    }

    const data = await engine.findApplicable(workspaceId, clientId, {
      total: cartTotal,
      itemCount,
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
