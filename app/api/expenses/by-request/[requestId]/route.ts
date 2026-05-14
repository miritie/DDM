/**
 * GET /api/expenses/by-request/[requestId]
 *
 * Retourne la dépense (expenses) créée à partir d'une expense_request donnée.
 * `requestId` accepte le UUID PK OU le business code `expense_request_id`.
 * Utilisé par le panel paiement embarqué sur la page de la sollicitation
 * (purchase_request ou expense_request) pour afficher le statut + déclencher
 * un paiement multi-wallet.
 *
 * Retourne `null` si la dépense n'a pas encore été créée (sollicitation pas
 * encore approuvée).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_VIEW);
    const { requestId } = await params;

    const r = await db.query<any>(
      `SELECT e.id, e.expense_id, e.expense_number, e.title, e.amount,
              e.status, e.payment_date, e.payer_id, e.category_id,
              e.workspace_id,
              u.full_name AS payer_name
       FROM expenses e
       LEFT JOIN users u ON u.id = e.payer_id
       WHERE e.expense_request_id::text = $1
          OR e.expense_request_id IN (
               SELECT id FROM expense_requests
               WHERE expense_request_id = $1 OR id::text = $1
             )
       LIMIT 1`,
      [requestId]
    );

    return NextResponse.json({ data: r.rows[0] ?? null });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
