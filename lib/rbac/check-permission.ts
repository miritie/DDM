/**
 * RBAC - Vérification des permissions côté serveur
 */

import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserPermissions } from './get-permissions';
import { Permission, hasPermission, hasAllPermissions, hasAnyPermission } from './permissions';
import { getPostgresClient } from '@/lib/database/postgres-client';

/**
 * Lit en DB live tous les role_id (UUID) assignés à l'utilisateur courant.
 * Évite que le JWT obsolète (figé à la connexion) bloque des permissions
 * légitimement attribuées depuis. Fallback : `user.roleId` du JWT.
 */
async function getCurrentUserRoleUuids(): Promise<string[]> {
  const user = await getCurrentUser();
  const userBusinessId = (user as any).userId;
  if (!userBusinessId) return user.roleId ? [user.roleId] : [];
  try {
    const db = getPostgresClient();
    const r = await db.query(
      `SELECT ur.role_id
       FROM user_roles ur
       JOIN users u ON u.id = ur.user_id
       WHERE u.user_id = $1 OR u.id::text = $1`,
      [userBusinessId]
    );
    if (r.rows.length === 0) return user.roleId ? [user.roleId] : [];
    return r.rows.map(x => x.role_id);
  } catch {
    return user.roleId ? [user.roleId] : [];
  }
}

/**
 * Union des permissions de TOUS les rôles assignés à l'utilisateur (lus DB).
 *
 * NB : on regarde tous les rôles, pas seulement le rôle actif. Le
 * `activeRoleId` reste utile pour l'UX mais n'agit pas comme filtre RBAC.
 */
async function getUserPermissionUnion(): Promise<string[]> {
  const roleIds = await getCurrentUserRoleUuids();
  const all: string[] = [];
  for (const rid of roleIds) {
    const perms = await getUserPermissions(rid);
    for (const p of perms) if (!all.includes(p)) all.push(p);
  }
  return all;
}

/**
 * Vérifie si l'utilisateur courant a une permission (sur l'union de ses rôles).
 */
export async function canAccess(requiredPermission: Permission): Promise<boolean> {
  try {
    const permissions = await getUserPermissionUnion();
    return hasPermission(permissions, requiredPermission);
  } catch {
    return false;
  }
}

/**
 * Vérifie si l'utilisateur courant a toutes les permissions
 */
export async function canAccessAll(requiredPermissions: Permission[]): Promise<boolean> {
  try {
    const permissions = await getUserPermissionUnion();
    return hasAllPermissions(permissions, requiredPermissions);
  } catch {
    return false;
  }
}

/**
 * Vérifie si l'utilisateur courant a au moins une permission
 */
export async function canAccessAny(requiredPermissions: Permission[]): Promise<boolean> {
  try {
    const permissions = await getUserPermissionUnion();
    return hasAnyPermission(permissions, requiredPermissions);
  } catch {
    return false;
  }
}

/**
 * Lève une erreur si l'utilisateur n'a pas la permission
 */
export async function requirePermission(requiredPermission: Permission): Promise<void> {
  const hasAccess = await canAccess(requiredPermission);
  if (!hasAccess) {
    throw new Error(`Permission refusée: ${requiredPermission}`);
  }
}

/**
 * Lève une erreur si l'utilisateur n'a pas toutes les permissions
 */
export async function requireAllPermissions(requiredPermissions: Permission[]): Promise<void> {
  const hasAccess = await canAccessAll(requiredPermissions);
  if (!hasAccess) {
    throw new Error(`Permissions refusées: ${requiredPermissions.join(', ')}`);
  }
}

/**
 * Lève une erreur si l'utilisateur n'a aucune des permissions
 */
export async function requireAnyPermission(requiredPermissions: Permission[]): Promise<void> {
  const hasAccess = await canAccessAny(requiredPermissions);
  if (!hasAccess) {
    throw new Error(`Au moins une permission requise parmi: ${requiredPermissions.join(', ')}`);
  }
}
