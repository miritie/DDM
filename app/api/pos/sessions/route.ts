/**
 * POST /api/pos/sessions  body: {outletId, gpsLat?, gpsLng?, gpsAccuracy?, deviceId?, startMethod?}
 *   → ouvre une session POS pour le commercial courant. Idempotent : renvoie celle déjà ouverte.
 *
 * GET  /api/pos/sessions?outletId=  → sessions actives sur un outlet (qui vend en ce moment)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { PosSessionService } from '@/lib/modules/outlets/pos-session-service';

const service = new PosSessionService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outletId');
    if (!outletId) return NextResponse.json({ error: 'outletId requis' }, { status: 400 });
    const data = await service.listActiveByOutlet(outletId);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.POS_SESSION_OPEN);
    const me = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    if (!body.outletId) return NextResponse.json({ error: 'outletId requis' }, { status: 400 });
    const data = await service.open({
      workspaceId,
      outletId: body.outletId,
      userId: (me as any).userId,
      startMethod: body.startMethod ?? 'explicit',
      deviceId: body.deviceId,
      gpsLat: body.gpsLat,
      gpsLng: body.gpsLng,
      gpsAccuracy: body.gpsAccuracy,
      notes: body.notes,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
