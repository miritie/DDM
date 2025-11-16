/**
 * API Route - Client par ID
 * GET /api/customers/[id] - Récupérer un client
 * PATCH /api/customers/[id] - Mettre à jour un client
 */

import { NextRequest, NextResponse } from 'next/server';
import { CustomerService } from '@/lib/modules/sales/customer-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new CustomerService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id } = await params;

    const customer = await service.getById(id);
    if (!customer) {
      return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ data: customer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);
    const { id } = await params;
    const body = await request.json();

    const customer = await service.update(id, body);
    return NextResponse.json({ data: customer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
