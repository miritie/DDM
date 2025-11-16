/**
 * API Routes - Transactions de Fidélité
 * Module Clients & Fidélité
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { LoyaltyService } from '@/lib/modules/customers';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new LoyaltyService();

/**
 * GET /api/customers/loyalty/transactions?customerId=xxx
 * Liste les transactions de fidélité d'un client
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_VIEW);

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId est requis' },
        { status: 400 }
      );
    }

    const transactions = await service.getTransactionHistory(customerId);

    return NextResponse.json({ data: transactions });
  } catch (error: any) {
    console.error('Error fetching loyalty transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/customers/loyalty/transactions
 * Crée une transaction de points (earn ou redeem)
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CUSTOMER_EDIT);

    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const { customerId, points, type, reason, referenceId, referenceType } = body;

    if (!customerId || !points || !type || !reason) {
      return NextResponse.json(
        { error: 'customerId, points, type et reason sont requis' },
        { status: 400 }
      );
    }

    let transaction;

    if (type === 'earn') {
      transaction = await service.earnPoints(
        customerId,
        points,
        reason,
        referenceId,
        referenceType,
        workspaceId
      );
    } else if (type === 'redeem') {
      transaction = await service.redeemPoints(
        customerId,
        points,
        reason,
        referenceId,
        referenceType,
        workspaceId
      );
    } else {
      return NextResponse.json(
        { error: 'Type invalide. Utilisez "earn" ou "redeem"' },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: transaction }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating loyalty transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
