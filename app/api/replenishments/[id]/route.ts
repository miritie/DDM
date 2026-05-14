import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { ReplenishmentService } from '@/lib/modules/replenishments/replenishment-service';

const service = new ReplenishmentService();

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.REPLENISHMENT_VIEW);
    const { id } = await params;
    const data = await service.getById(id);
    if (!data) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
