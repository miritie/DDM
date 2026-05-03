import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { PosSessionService } from '@/lib/modules/outlets/pos-session-service';

const service = new PosSessionService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.POS_SESSION_OPEN);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = await service.close(id, body.notes);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
