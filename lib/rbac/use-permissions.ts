/**
 * RBAC - Hooks pour les Client Components
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Permission } from './permissions';

/**
 * Hook pour récupérer les permissions de l'utilisateur courant.
 *
 * Important : on s'appuie sur `status` de NextAuth, pas seulement sur
 * `session?.user`. Sinon, pendant le tout premier rendu (`status==='loading'`),
 * `user` est `undefined` et on aurait à tort `loading=false` avec
 * `permissions=[]`, ce qui ferait clignoter un écran « Accès refusé »
 * sur les pages protégées avant que la session ne se résolve.
 */
export function usePermissions() {
  const { data: session, status } = useSession();
  const user = session?.user;
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleCodes, setRoleCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tant que NextAuth charge la session, on reste en loading.
    if (status === 'loading') {
      setLoading(true);
      return;
    }

    if (!user) {
      setPermissions([]);
      setRoleCodes([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Récupérer les permissions via API — no-store pour éviter tout cache
    // (les permissions peuvent changer en DB sans nouvelle connexion).
    async function fetchPermissions() {
      setLoading(true);
      try {
        const response = await fetch('/api/rbac/permissions', { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;
        setPermissions(data.permissions || []);
        setRoleCodes(data.roleCodes || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        if (cancelled) return;
        setPermissions([]);
        setRoleCodes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPermissions();
    return () => { cancelled = true; };
  }, [user, status]);

  return { permissions, roleCodes, loading };
}

/**
 * Hook pour vérifier l'appartenance à un rôle (par business code).
 * Utile pour des gardes qui dépassent les permissions (ex: une approbation
 * réservée au rôle admin même si la permission est plus large).
 */
export function useHasRole(roleCode: string) {
  const { roleCodes, loading } = usePermissions();
  return { hasRole: roleCodes.includes(roleCode), loading };
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
