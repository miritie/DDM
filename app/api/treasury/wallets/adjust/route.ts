/**
 * POST /api/treasury/wallets/adjust
 *
 * Inventaire wallet : ajuste le solde théorique au cash physique compté.
 * Body : { walletId, countedBalance, reason? }
 *
 * Génère une transaction de type 'income' (si surplus compté) ou 'expense'
 * (si manque) avec category='adjustment'. Le solde du wallet est mis à
 * jour automatiquement par TransactionService.
 *
 * Audit trail garanti via la table transactions.
 *
 * Permission : ADMIN_SETTINGS_EDIT (admin) ou EXPENSE_PAY (comptable).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { TransactionService } from '@/lib/modules/treasury/transaction-service';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();
const transactionService = new TransactionService();

export async function POST(request: NextRequest) {
  try {
    // Admin OU comptable
    try {
      await requirePermission(PERMISSIONS.EXPENSE_PAY);
    } catch {
      await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    }

    const workspaceId = await getCurrentWorkspaceId();
    const processedById = await getCurrentUserId();
    const body = await request.json();

    if (!body?.walletId) {
      return NextResponse.json({ error: 'walletId requis' }, { status: 400 });
    }
    if (typeof body.countedBalance !== 'number' || body.countedBalance < 0) {
      return NextResponse.json({ error: 'countedBalance doit être un nombre positif' }, { status: 400 });
    }

    // Récupère le solde théorique actuel
    const wR = await db.query<any>(
      `SELECT id, wallet_id, name, balance FROM wallets
       WHERE (id::text = $1 OR wallet_id = $1) AND workspace_id = $2
       LIMIT 1`,
      [body.walletId, workspaceId]
    );
    if (wR.rows.length === 0) {
      return NextResponse.json({ error: 'Wallet introuvable' }, { status: 404 });
    }
    const wallet = wR.rows[0];
    const before = Number(wallet.balance);
    const after = Number(body.countedBalance);
    const delta = +(after - before).toFixed(2);

    if (Math.abs(delta) < 0.01) {
      return NextResponse.json({
        data: { applied: false, wallet, delta: 0 },
      });
    }

    // Résolution payerId UUID (le service createXxx attend des UUIDs)
    const uR = await db.query<any>(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [processedById]
    );
    if (uR.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 400 });
    }
    const userUuid = uR.rows[0].id;
    const description = `Inventaire wallet "${wallet.name}" — ajustement ${delta > 0 ? '+' : ''}${delta} (avant ${before}, après ${after})${body.reason ? ` · ${body.reason}` : ''}`;

    let tx;
    if (delta > 0) {
      tx = await transactionService.createIncome({
        type: 'income',
        category: 'adjustment',
        amount: delta,
        destinationWalletId: wallet.id,
        description,
        reference: `INV-${new Date().toISOString().slice(0, 10)}`,
        processedById: userUuid,
        workspaceId,
      });
    } else {
      tx = await transactionService.createExpense({
        type: 'expense',
        category: 'adjustment',
        amount: -delta,
        sourceWalletId: wallet.id,
        description,
        reference: `INV-${new Date().toISOString().slice(0, 10)}`,
        processedById: userUuid,
        workspaceId,
      });
    }

    return NextResponse.json({
      data: { applied: true, wallet, delta, transaction: tx },
    });
  } catch (e: any) {
    console.error('Wallet adjust error:', e);
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
