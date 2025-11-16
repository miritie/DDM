/**
 * API Route - Clients
 * GET /api/customers - Lister les clients
 * POST /api/customers - Créer un client
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
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q');
    const isActive = searchParams.get('isActive');

    if (query) {
      const customers = await service.search(workspaceId, query);
      return NextResponse.json({ data: customers });
    }

    const customers = await service.list(workspaceId, {
      isActive: isActive ? isActive === 'true' : undefined,
    });

    return NextResponse.json({ data: customers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const customer = await service.create({
      ...body,
      workspaceId,
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
