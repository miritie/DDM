/**
 * POST /api/checkin/sessions — le caissier crée une session de pairing.
 * Réponse : { token, url } à encoder dans un QR.
 */

import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { CheckinService } from '@/lib/modules/sales/checkin-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new CheckinService();

export async function POST() {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const session = await service.create(workspaceId);
    return NextResponse.json({
      data: {
        token: session.token,
        path: `/checkin/${session.token}`,
        expiresAt: session.expiresAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
