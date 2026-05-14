/**
 * API Routes - Client par ID
 *
 * GET   /api/clients/[id]                — détail + commandes liées
 * PATCH /api/clients/[id]                — mise à jour (champ par champ ou { isActive })
 *
 * Le [id] accepte UUID PK ou business code (client_id VARCHAR).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { ClientService } from '@/lib/modules/sales/client-service';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new ClientService();
const db = getPostgresClient();

async function resolveClientUuid(id: string, workspaceId: string): Promise<string | null> {
  const r = await db.query(
    `SELECT id FROM clients WHERE workspace_id = $1 AND (id::text = $2 OR client_id = $2) LIMIT 1`,
    [workspaceId, id]
  );
  return r.rows[0]?.id ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CLIENT_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { id } = await params;
    const uuid = await resolveClientUuid(id, workspaceId);
    if (!uuid) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });

    const client = await service.getById(uuid);
    if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });

    // Statistiques + dernières commandes
    const orders = await db.query(
      `SELECT id, order_id, order_number, status, total_amount, amount_paid, balance,
              currency, created_at, requested_delivery_date
       FROM customer_orders
       WHERE workspace_id = $1 AND client_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [workspaceId, uuid]
    );

    const stats = {
      ordersCount:      orders.rows.length,
      totalAmount:      orders.rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
      totalPaid:        orders.rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0),
      totalOutstanding: orders.rows.reduce((s, r) => s + Number(r.balance || 0), 0),
    };

    return NextResponse.json({ data: { client, stats, orders: orders.rows } });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.CLIENT_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const { id } = await params;
    const body = await request.json();

    const uuid = await resolveClientUuid(id, workspaceId);
    if (!uuid) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });

    // Activation / désactivation
    if (typeof body.isActive === 'boolean') {
      const updated = await service.setActive(uuid, body.isActive);
      return NextResponse.json({ data: updated });
    }

    const updated = await service.update(uuid, {
      name: body.name,
      companyName: body.companyName,
      phone: body.phone,
      email: body.email,
      address: body.address,
      taxId: body.taxId,
      creditLimit: body.creditLimit,
    });
    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
