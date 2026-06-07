/**
 * Garde serveur par RÔLE — complément de requirePermission.
 *
 * Les jeux de permissions stockés en base se sont révélés incohérents
 * (un opérateur portait production:approve, un manager ne l'avait pas).
 * Pour les décisions métier qui suivent l'ORGANIGRAMME (qui valide la
 * production, qui voit quel écran), le rôle fait foi : permission OU
 * rôle autorisé.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { getCurrentUserUuid } from '@/lib/auth/get-session';
import { canAccess } from './check-permission';
import { Permission } from './permissions';
import { PermissionError } from '@/lib/http/api-error';

const db = getPostgresClient();

/** Slugs métier (roles.role_id) de l'utilisateur courant — rôle principal + user_roles. */
export async function getCurrentRoleSlugs(): Promise<string[]> {
  const uuid = await getCurrentUserUuid();
  if (!uuid) return [];
  const r = await db.query<any>(
    `SELECT DISTINCT r.role_id
     FROM roles r
     WHERE r.id IN (
       SELECT role_id FROM user_roles WHERE user_id = $1
       UNION
       SELECT role_id FROM users WHERE id = $1 AND role_id IS NOT NULL
     )`,
    [uuid]
  );
  return r.rows.map((x: any) => x.role_id);
}

/**
 * Passe si l'utilisateur a la permission OU l'un des rôles listés.
 * Throw PermissionError (403) sinon.
 */
export async function requirePermissionOrRole(
  permission: Permission,
  allowedRoles: string[]
): Promise<void> {
  if (await canAccess(permission)) return;
  const slugs = await getCurrentRoleSlugs();
  if (slugs.some(s => allowedRoles.includes(s))) return;
  throw new PermissionError(`Permission refusée: ${permission}`);
}
