/**
 * API Route - Statistiques clients
 * GET /api/customers/statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { CustomerService } from '@/lib/modules/sales/customer-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new CustomerService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();

    const statistics = await service.getStatistics(workspaceId);
    return NextResponse.json({ data: statistics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
