/**
 * API Route - Enregistrer un paiement
 * POST /api/sales/[id]/payment - Ajouter un paiement à une vente
 * GET /api/sales/[id]/payment - Lister les paiements d'une vente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUser } from '@/lib/auth/get-session';
import { SaleService } from '@/lib/modules/sales/sale-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new SaleService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const { id: saleId } = await params;
    const workspaceId = await getCurrentWorkspaceId();
    const user = await getCurrentUser();
    const body = await request.json();

    const payment = await service.recordPayment({
      saleId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentDate: body.paymentDate || new Date().toISOString().split('T')[0],
      walletId: body.walletId,
      reference: body.reference,
      notes: body.notes,
      receivedById: user.userId,
      workspaceId,
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id: saleId } = await params;

    const payments = await service.getPayments(saleId);
    return NextResponse.json({ data: payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
