/**
 * API Routes - Wallets - Opérations par ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { WalletService } from '@/lib/modules/treasury/wallet-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new WalletService();

/**
 * GET /api/treasury/wallets/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);
    const { id } = await params;

    const wallet = await service.getById(id);

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: wallet });
  } catch (error: any) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/treasury/wallets/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_EDIT);
    const { id } = await params;

    const body = await request.json();
    const updated = await service.update(id, body);

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/treasury/wallets/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_DELETE);
    const { id } = await params;

    await service.close(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error closing wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la clôture' },
      { status: 500 }
    );
  }
}
