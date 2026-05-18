/**
 * API Route - Récupération des permissions utilisateur
 *
 * Lit les rôles assignés en DB live (évite le JWT obsolète après ajout de rôles)
 * et retourne l'union de toutes les permissions associées.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserPermissions } from '@/lib/rbac/get-permissions';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Lecture DB live des rôles assignés (évite JWT obsolète).
    const userBusinessId = (user as any).userId;
    let roleUuids: string[] = [];
    if (userBusinessId) {
      const r = await db.query(
        `SELECT ur.role_id FROM user_roles ur
         JOIN users u ON u.id = ur.user_id
         WHERE u.user_id = $1 OR u.id::text = $1`,
        [userBusinessId]
      );
      roleUuids = r.rows.map((x: any) => x.role_id);
    }
    if (roleUuids.length === 0) {
      // Fallback : JWT
      roleUuids = (user as any).roleIds && (user as any).roleIds.length > 0
        ? (user as any).roleIds
        : [user.roleId];
    }

    const all = new Set<string>();
    for (const rid of roleUuids) {
      const perms = await getUserPermissions(rid);
      perms.forEach(p => all.add(p));
    }

    // Expose aussi les business codes des rôles assignés. Permet aux
    // pages client de vérifier "is admin" sans une nouvelle requête.
    // user_roles.role_id stocke des UUIDs ; roles.role_id stocke le code.
    let roleCodes: string[] = [];
    if (roleUuids.length > 0) {
      const rr = await db.query(
        `SELECT role_id FROM roles WHERE id = ANY($1::uuid[])`,
        [roleUuids]
      );
      roleCodes = rr.rows.map((x: any) => x.role_id);
    }

    return NextResponse.json({ permissions: Array.from(all), roleCodes });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des permissions' }, { status: 500 });
  }
}
