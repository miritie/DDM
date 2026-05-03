/**
 * GET /api/outlets/active
 *
 * Renvoie les outlets sur lesquels l'utilisateur courant est censé être aujourd'hui
 * (overrides + assignments hebdo). Sert à pré-sélectionner l'outlet sur le POS.
 *
 * Cas spécial : si l'utilisateur a la permission `outlet:edit` ou `outlet:assign`
 * (admin / manager), tous les outlets actifs sont également renvoyés, marqués comme
 * "fallback" pour différenciation côté UI.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser, getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { OutletService } from '@/lib/modules/outlets/outlet-service';
import { canAccessAny, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new OutletService();
const db = getPostgresClient();

export async function GET() {
  try {
    const me = await getCurrentUser();
    const workspaceId = await getCurrentWorkspaceId();

    // Résolution slug user_id → UUID (session.user.userId est le VARCHAR slug)
    const idOrSlug = (me as any).userId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    let userUuid: string;
    if (isUuid) {
      userUuid = idOrSlug;
    } else {
      const r = await db.query(
        `SELECT id FROM users WHERE user_id = $1 OR email = $1 LIMIT 1`,
        [idOrSlug]
      );
      if (r.rows.length === 0) return NextResponse.json({ data: [] });
      userUuid = r.rows[0].id;
    }

    // Outlets affectés via planning
    const assignedIds = await service.getOutletsForUser(userUuid, workspaceId);
    const assigned = (await Promise.all(assignedIds.map(id => service.getById(id)))).filter(Boolean) as any[];

    // Si l'utilisateur a un privilège élevé : ajoute aussi tous les autres outlets actifs
    const isPrivileged = await canAccessAny([
      PERMISSIONS.OUTLET_EDIT,
      PERMISSIONS.OUTLET_ASSIGN,
      PERMISSIONS.ADMIN_USERS_VIEW, // admin
    ]);

    let allActive: any[] = [];
    if (isPrivileged) {
      const all = await service.list(workspaceId, { isActive: true });
      const assignedSet = new Set(assigned.map(o => o.id));
      allActive = all.filter(o => !assignedSet.has(o.id));
    }

    return NextResponse.json({
      data: [
        ...assigned.map(o => ({ ...o, source: 'assignment' as const })),
        ...allActive.map(o => ({ ...o, source: 'fallback' as const })),
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
