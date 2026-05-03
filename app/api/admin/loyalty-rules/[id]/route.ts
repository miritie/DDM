/**
 * PUT /api/admin/loyalty-rules/[id] — édition
 * DELETE /api/admin/loyalty-rules/[id] — suppression
 */

import { NextRequest, NextResponse } from 'next/server';
import { LoyaltyEngine } from '@/lib/modules/loyalty/loyalty-engine';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const engine = new LoyaltyEngine();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const { id } = await params;
    const body = await request.json();
    const data = await engine.update(id, body);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const { id } = await params;
    await engine.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
