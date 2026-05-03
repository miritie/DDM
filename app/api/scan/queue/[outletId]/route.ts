/**
 * GET /api/scan/queue/[outletId]
 *   File des scans clients en attente d'attribution sur un outlet (côté commercial).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { ScanQueueService } from '@/lib/modules/outlets/scan-queue-service';

const scanQueue = new ScanQueueService();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ outletId: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const { outletId } = await params;
    const data = await scanQueue.listActive(outletId);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
