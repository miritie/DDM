/**
 * POST /api/production/purchase-requests/[id]/receive
 *   Enregistre la réception d'une ligne de la sollicitation MP.
 *   Body : { purchaseRequestLineId, qty, unitPrice, notes? }
 *   Effet : incrémente le stock MP, recalcule PMP, met à jour la ligne PR, trace dans ingredient_receptions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentUserId } from '@/lib/auth/get-session';
import { PurchaseRequestService } from '@/lib/modules/production/purchase-request-service';

const service = new PurchaseRequestService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.PURCHASE_REQUEST_RECEIVE);
    await params; // l'id du PR est dans l'URL pour traçabilité — la ligne est dans le body
    const body = await request.json();
    if (!body.purchaseRequestLineId || !body.qty || body.unitPrice == null) {
      return NextResponse.json(
        { error: 'purchaseRequestLineId, qty et unitPrice requis' },
        { status: 400 }
      );
    }
    const receivedById = await getCurrentUserId();
    const data = await service.receiveLine({
      purchaseRequestLineId: body.purchaseRequestLineId,
      qty: Number(body.qty),
      unitPrice: Number(body.unitPrice),
      receivedById,
      notes: body.notes,
    });
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
