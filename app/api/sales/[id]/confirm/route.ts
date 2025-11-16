/**
 * API Route - Confirmer une vente
 * POST /api/sales/[id]/confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { SaleService } from '@/lib/modules/sales/sale-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new SaleService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_EDIT);
    const { id } = await params;

    const sale = await service.confirm(id);
    return NextResponse.json({ data: sale });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
