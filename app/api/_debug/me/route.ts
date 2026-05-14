/**
 * GET /api/_debug/me — diagnostic session/RBAC.
 *
 * Renvoie : userId, workspaceId, activeRoleId, liste des rôles assignés
 * (avec leur nom métier), union des permissions, et permissions du rôle
 * actif uniquement.
 *
 * Aide à comprendre pourquoi un user voit "Permission refusée" :
 *   - quel est mon rôle actif ?
 *   - ai-je bien la permission demandée dans ce rôle ?
 *   - dois-je switcher de rôle ?
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserPermissions } from '@/lib/rbac/get-permissions';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const activeRoleId = (user as any).activeRoleId || user.roleId;
    const userBusinessId = (user as any).userId;

    // Lecture DB live des rôles assignés (ignore JWT obsolète).
    let roleIds: string[] = [];
    if (userBusinessId) {
      const r = await db.query(
        `SELECT ur.role_id FROM user_roles ur
         JOIN users u ON u.id = ur.user_id
         WHERE u.user_id = $1 OR u.id::text = $1`,
        [userBusinessId]
      );
      roleIds = r.rows.map((x: any) => x.role_id);
    }
    if (roleIds.length === 0) {
      roleIds = (user as any).roleIds && (user as any).roleIds.length > 0
        ? (user as any).roleIds
        : [user.roleId];
    }

    // Lookup détails des rôles
    const rolesInfo = await db.query(
      `SELECT id, role_id, name FROM roles WHERE id = ANY($1::uuid[])`,
      [roleIds]
    );

    // Permissions par rôle
    const byRole: Record<string, { role: string; name: string; permissions: string[] }> = {};
    for (const r of rolesInfo.rows) {
      const perms = await getUserPermissions(r.id);
      byRole[r.id] = { role: r.role_id, name: r.name, permissions: perms };
    }

    // Union
    const union = new Set<string>();
    Object.values(byRole).forEach(r => r.permissions.forEach(p => union.add(p)));

    const active = byRole[activeRoleId] || null;

    return NextResponse.json({
      userId: (user as any).userId,
      workspaceId: (user as any).workspaceId,
      activeRoleId,
      activeRoleLabel: active?.role ?? '(introuvable)',
      activeRoleName: active?.name ?? '(introuvable)',
      assignedRoles: Object.values(byRole).map(r => ({ role: r.role, name: r.name, count: r.permissions.length })),
      activeRolePermissions: active?.permissions ?? [],
      effectivePermissions: Array.from(union).sort(),
      note: "Depuis le fix RBAC : la vérification se fait sur l'union de TOUS les rôles assignés, pas seulement le rôle actif.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
