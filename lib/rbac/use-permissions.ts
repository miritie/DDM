/**
 * RBAC - Hooks pour les Client Components
 */

'use client';

import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/auth/use-session';
import { Permission } from './permissions';

/**
 * Hook pour récupérer les permissions de l'utilisateur courant
 */
export function usePermissions() {
  const user = useCurrentUser();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    // Récupérer les permissions via API
    async function fetchPermissions() {
      try {
        const response = await fetch('/api/rbac/permissions');
        const data = await response.json();
        setPermissions(data.permissions || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPermissions();
  }, [user]);

  return { permissions, loading };
}

/**
 * Hook pour vérifier une permission
 */
export function useHasPermission(requiredPermission: Permission) {
  const { permissions, loading } = usePermissions();
  const hasPermission = permissions.includes(requiredPermission);
  return { hasPermission, loading };
}

/**
 * Hook pour vérifier plusieurs permissions (AND)
 */
export function useHasAllPermissions(requiredPermissions: Permission[]) {
  const { permissions, loading } = usePermissions();
  const hasAllPermissions = requiredPermissions.every((p) => permissions.includes(p));
  return { hasAllPermissions, loading };
}

/**
 * Hook pour vérifier plusieurs permissions (OR)
 */
export function useHasAnyPermission(requiredPermissions: Permission[]) {
  const { permissions, loading } = usePermissions();
  const hasAnyPermission = requiredPermissions.some((p) => permissions.includes(p));
  return { hasAnyPermission, loading };
}
