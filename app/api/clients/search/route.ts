/**
 * GET /api/clients/search?q=... — recherche clients par nom/téléphone (table clients)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ClientService } from '@/lib/modules/sales/client-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ClientService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    if (q.length < 1) {
      return NextResponse.json({ data: [] });
    }
    const data = await service.search(workspaceId, q);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erreur' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
