/**
 * Composant RBAC - Affichage conditionnel basé sur les permissions
 */

'use client';

import { ReactNode } from 'react';
import { useHasPermission, useHasAllPermissions, useHasAnyPermission } from '@/lib/rbac/use-permissions';
import { Permission } from '@/lib/rbac/permissions';

interface CanProps {
  children: ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

/**
 * Composant pour afficher du contenu conditionnel basé sur les permissions
 *
 * @example
 * <Can permission={PERMISSIONS.EXPENSE_CREATE}>
 *   <Button>Créer une dépense</Button>
 * </Can>
 *
 * @example
 * <Can permissions={[PERMISSIONS.EXPENSE_APPROVE, PERMISSIONS.EXPENSE_PAY]} requireAll>
 *   <Button>Approuver et payer</Button>
 * </Can>
 */
export function Can({ children, permission, permissions, requireAll = false, fallback = null }: CanProps) {
  const singlePermCheck = useHasPermission(permission!);
  const allPermsCheck = useHasAllPermissions(permissions || []);
  const anyPermCheck = useHasAnyPermission(permissions || []);

  let hasAccess = false;
  let loading = false;

  if (permission) {
    hasAccess = singlePermCheck.hasPermission;
    loading = singlePermCheck.loading;
  } else if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = allPermsCheck.hasAllPermissions;
      loading = allPermsCheck.loading;
    } else {
      hasAccess = anyPermCheck.hasAnyPermission;
      loading = anyPermCheck.loading;
    }
  }

  if (loading) {
    return null; // Ou un skeleton loader
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Composant inverse - Affiche le contenu si l'utilisateur n'a PAS la permission
 */
export function Cannot({ children, permission, permissions, fallback = null }: Omit<CanProps, 'requireAll'>) {
  const singlePermCheck = useHasPermission(permission!);
  const anyPermCheck = useHasAnyPermission(permissions || []);

  let hasAccess = false;
  let loading = false;

  if (permission) {
    hasAccess = singlePermCheck.hasPermission;
    loading = singlePermCheck.loading;
  } else if (permissions && permissions.length > 0) {
    hasAccess = anyPermCheck.hasAnyPermission;
    loading = anyPermCheck.loading;
  }

  if (loading) {
    return null;
  }

  if (hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
