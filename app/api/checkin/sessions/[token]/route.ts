/**
 * GET /api/checkin/sessions/[token] — le caissier poll cette URL pour savoir
 * si le client a soumis ses infos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { CheckinService } from '@/lib/modules/sales/checkin-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new CheckinService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const { token } = await params;

    const session = await service.get(token);
    if (!session || session.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
    }
    return NextResponse.json({ data: session });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
