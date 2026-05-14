/**
 * Composant RBAC - Protection de pages entières
 */

'use client';

import { ReactNode, useEffect, useState } from 'react';
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

  // Pas d'auto-redirect : on affiche d'abord la carte de diagnostic
  // pour permettre à l'utilisateur de comprendre la cause exacte.

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
    if (!showError) return null;
    return <AccessDeniedDiagnostic
      permission={permission}
      permissions={permissions}
      redirectTo={redirectTo}
      onRetry={() => window.location.reload()}
    />;
  }

  return <>{children}</>;
}

/**
 * Écran "Accès refusé" enrichi : affiche le rôle actif vu par le serveur,
 * les permissions effectives et la permission manquante pour aider à comprendre.
 */
function AccessDeniedDiagnostic({
  permission, permissions, redirectTo, onRetry,
}: {
  permission?: Permission;
  permissions?: Permission[];
  redirectTo: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  const [diag, setDiag] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/_debug/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(setDiag)
      .catch(() => setDiag(null));
  }, []);

  const required = permission ? [permission] : (permissions || []);
  const effective: string[] = diag?.effectivePermissions || [];
  const missing = required.filter(r => !effective.includes(r as string));

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-red-600">
            Accès refusé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <p className="font-semibold text-red-800">Permission(s) requise(s) pour cette page :</p>
            <ul className="list-disc list-inside mt-1 font-mono text-xs text-red-900">
              {required.map(p => <li key={p}>{p}{missing.includes(p) && ' ← manquante'}</li>)}
            </ul>
          </div>

          {diag ? (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded space-y-2">
              <p><strong>Vu par le serveur :</strong></p>
              <p>Utilisateur : <span className="font-mono text-xs">{diag.userId}</span></p>
              <p>Rôle actif : <span className="font-mono text-xs">{diag.activeRoleLabel}</span> ({diag.activeRoleName})</p>
              <p>Rôles assignés : {(diag.assignedRoles || []).map((r: any) => (
                <span key={r.role} className="inline-block px-2 py-0.5 m-0.5 rounded bg-blue-100 text-blue-800 text-xs">
                  {r.role} ({r.count} perms)
                </span>
              ))}</p>
              <p className="text-xs text-gray-600">
                Permissions effectives totales : <strong>{diag.effectivePermissions?.length || 0}</strong>
              </p>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
              Impossible de récupérer le diagnostic. Es-tu bien connecté ?
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              Recharger
            </button>
            <button
              onClick={() => router.push(redirectTo)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retour
            </button>
          </div>

          {missing.length > 0 && diag?.effectivePermissions?.length === 0 && (
            <p className="text-xs text-gray-600 text-center">
              💡 Si vous étiez déjà connecté avant la dernière mise à jour, déconnectez-vous puis reconnectez-vous pour régénérer votre session.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
