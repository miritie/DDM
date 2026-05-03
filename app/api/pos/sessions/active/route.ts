/**
 * GET /api/pos/sessions/active?outletId=
 *   → session active de l'utilisateur courant sur un outlet (ou null)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { PosSessionService } from '@/lib/modules/outlets/pos-session-service';

const service = new PosSessionService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const me = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outletId');
    if (!outletId) return NextResponse.json({ error: 'outletId requis' }, { status: 400 });
    const data = await service.getActiveSession(outletId, (me as any).userId);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
