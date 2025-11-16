/**
 * API Routes - Transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const service = new TransactionService();

/**
 * GET /api/treasury/transactions - Liste des transactions
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);

    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const filters: any = {};
    if (searchParams.get('type')) {
      filters.type = searchParams.get('type');
    }
    if (searchParams.get('category')) {
      filters.category = searchParams.get('category');
    }
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    if (searchParams.get('walletId')) {
      filters.walletId = searchParams.get('walletId');
    }

    const transactions = await service.list(workspaceId, filters);

    return NextResponse.json({ data: transactions });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/treasury/transactions - Création
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_CREATE);

    const user = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    let transaction;

    // Créer selon le type
    switch (body.type) {
      case 'income':
        transaction = await service.createIncome({
          ...body,
          processedById: user.userId,
          workspaceId,
        });
        break;
      case 'expense':
        transaction = await service.createExpense({
          ...body,
          processedById: user.userId,
          workspaceId,
        });
        break;
      case 'transfer':
        transaction = await service.createTransfer({
          ...body,
          processedById: user.userId,
          workspaceId,
        });
        break;
      default:
        throw new Error('Type de transaction invalide');
    }

    return NextResponse.json({ data: transaction }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
