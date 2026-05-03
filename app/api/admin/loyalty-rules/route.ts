/**
 * GET /api/admin/loyalty-rules — liste
 * POST /api/admin/loyalty-rules — création
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
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const data = await engine.list(workspaceId, includeInactive);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }
    if (!['percentage', 'fixed_amount'].includes(body.rewardType)) {
      return NextResponse.json({ error: 'rewardType invalide' }, { status: 400 });
    }
    if (typeof body.rewardValue !== 'number' || body.rewardValue <= 0) {
      return NextResponse.json({ error: 'rewardValue doit être > 0' }, { status: 400 });
    }

    const data = await engine.create({ ...body, workspaceId });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
