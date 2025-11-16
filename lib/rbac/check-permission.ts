/**
 * RBAC - Vérification des permissions côté serveur
 */

import { getCurrentUser } from '@/lib/auth/get-session';
import { getUserPermissions } from './get-permissions';
import { Permission, hasPermission, hasAllPermissions, hasAnyPermission } from './permissions';

/**
 * Vérifie si l'utilisateur courant a une permission
 */
export async function canAccess(requiredPermission: Permission): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const permissions = await getUserPermissions(user.roleId);
    return hasPermission(permissions, requiredPermission);
  } catch (error) {
    return false;
  }
}

/**
 * Vérifie si l'utilisateur courant a toutes les permissions
 */
export async function canAccessAll(requiredPermissions: Permission[]): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const permissions = await getUserPermissions(user.roleId);
    return hasAllPermissions(permissions, requiredPermissions);
  } catch (error) {
    return false;
  }
}

/**
 * Vérifie si l'utilisateur courant a au moins une permission
 */
export async function canAccessAny(requiredPermissions: Permission[]): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    const permissions = await getUserPermissions(user.roleId);
    return hasAnyPermission(permissions, requiredPermissions);
  } catch (error) {
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
