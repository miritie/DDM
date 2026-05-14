/**
 * API Routes - Clients grossistes (B2B)
 *
 * GET  /api/clients               — liste (?isActive=, ?search=)
 * POST /api/clients               — crée un client complet
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ClientService } from '@/lib/modules/sales/client-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new ClientService();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CLIENT_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: { isActive?: boolean; search?: string } = {};
    const isActive = searchParams.get('isActive');
    if (isActive !== null) filters.isActive = isActive === 'true';
    const search = searchParams.get('search');
    if (search) filters.search = search;

    const data = await service.list(workspaceId, filters);
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
    await requirePermission(PERMISSIONS.CLIENT_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Le nom est obligatoire' }, { status: 400 });
    }

    const data = await service.create({
      name: body.name,
      companyName: body.companyName,
      phone: body.phone,
      email: body.email,
      address: body.address,
      taxId: body.taxId,
      creditLimit: body.creditLimit,
      workspaceId,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
