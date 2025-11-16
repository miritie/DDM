/**
 * API Routes - Paiements de Ventes
 * Module Ventes & Encaissements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { SaleService } from '@/lib/modules/sales/sale-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new SaleService();

/**
 * GET /api/sales/[id]/payments - Liste des paiements
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id } = await params;

    const payments = await service.getPayments(id);

    return NextResponse.json({ data: payments });
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales/[id]/payments - Enregistrer un paiement
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const { id } = await params;

    const user = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const payment = await service.recordPayment({
      saleId: id,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentDate: body.paymentDate || new Date().toISOString(),
      walletId: body.walletId,
      reference: body.reference,
      notes: body.notes,
      receivedById: user.userId,
      workspaceId,
    });

    return NextResponse.json({ data: payment }, { status: 201 });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de l\'enregistrement' },
      { status: 500 }
    );
  }
}
