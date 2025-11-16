/**
 * Composant RBAC - Protection de pages entières
 */

'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHasPermission, useHasAllPermissions, useHasAnyPermission } from '@/lib/rbac/use-permissions';
import { Permission } from '@/lib/rbac/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProtectedPageProps {
  children: ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  redirectTo?: string;
  showError?: boolean;
}

/**
 * Composant pour protéger une page entière avec des permissions
 *
 * @example
 * export default function ExpensesPage() {
 *   return (
 *     <ProtectedPage permission={PERMISSIONS.EXPENSE_VIEW}>
 *       <ExpensesList />
 *     </ProtectedPage>
 *   );
 * }
 */
export function ProtectedPage({
  children,
  permission,
  permissions,
  requireAll = false,
  redirectTo = '/dashboard',
  showError = true,
}: ProtectedPageProps) {
  const router = useRouter();
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

  useEffect(() => {
    if (!loading && !hasAccess && redirectTo) {
      router.push(redirectTo);
    }
  }, [loading, hasAccess, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (!showError) {
      return null;
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-red-600">
              Accès refusé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">
                Vous n'avez pas les permissions nécessaires pour accéder à cette page.
              </p>
            </div>
            <button
              onClick={() => router.push(redirectTo)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retour au tableau de bord
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
