/**
 * RBAC - Récupérer les permissions utilisateur (PostgreSQL)
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Permission } from './permissions';

/**
 * Récupère les permissions d'un utilisateur à partir de son rôle
 */
export async function getUserPermissions(roleId: string): Promise<Permission[]> {
  try {
    const db = getPostgresClient();

    // Récupérer les permissions associées au rôle via la table role_permissions
    const result = await db.query(
      `SELECT p.code
       FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [roleId]
    );

    return result.rows.map(row => row.code as Permission);
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}

/**
 * Vérifie si un utilisateur a une permission spécifique
 */
export async function userHasPermission(
  roleId: string,
  requiredPermission: Permission
): Promise<boolean> {
  const permissions = await getUserPermissions(roleId);
  return permissions.includes(requiredPermission);
}

/**
 * Vérifie si un utilisateur a toutes les permissions requises
 */
export async function userHasAllPermissions(
  roleId: string,
  requiredPermissions: Permission[]
): Promise<boolean> {
  const permissions = await getUserPermissions(roleId);
  return requiredPermissions.every((p) => permissions.includes(p));
}

/**
 * Vérifie si un utilisateur a au moins une des permissions requises
 */
export async function userHasAnyPermission(
  roleId: string,
  requiredPermissions: Permission[]
): Promise<boolean> {
  const permissions = await getUserPermissions(roleId);
  return requiredPermissions.some((p) => permissions.includes(p));
}
