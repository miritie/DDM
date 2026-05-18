import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getCurrentActiveRoleId, getCurrentUserRoleIds } from '@/lib/auth/get-session';
import { CustomerOrderService } from '@/lib/modules/customer-orders/customer-order-service';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new CustomerOrderService();
const db = getPostgresClient();

// Vérifie que l'utilisateur courant a le rôle admin (par business code
// 'admin'). Plus strict que requirePermission(ADMIN_USERS_VIEW) qui peut
// avoir été accordée par mégarde à d'autres rôles via des migrations.
async function requireAdminRole(): Promise<void> {
  const activeUuid = await getCurrentActiveRoleId();
  const allUuids = await getCurrentUserRoleIds();
  const toCheck = Array.from(new Set([activeUuid, ...allUuids].filter(Boolean)));
  if (toCheck.length === 0) throw new Error('Permission refusée : aucun rôle actif');
  const r = await db.query(
    `SELECT role_id FROM roles WHERE id = ANY($1::uuid[])`,
    [toCheck]
  );
  const isAdmin = r.rows.some((row: any) => row.role_id === 'admin');
  if (!isAdmin) {
    throw new Error("Permission refusée : seul un administrateur peut approuver une commande négociée.");
  }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminRole();
    const me = await getCurrentUser();
    const { id } = await params;
    const data = await service.approve(id, (me as any).userId);
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message?.includes('Permission') ? 403 : 500 });
  }
}
