'use client';

/**
 * Page - Sélection du rôle actif après connexion (ou switch en cours de session)
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, LogOut, Loader2, AlertCircle } from 'lucide-react';

interface RoleOption {
  id: string;
  roleId: string;
  name: string;
  description: string | null;
}

function SelectRoleInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const next = searchParams.get('next') || '/dashboard';

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }
    void loadRoles();
  }, [status]);

  async function loadRoles() {
    try {
      const res = await fetch('/api/auth/my-roles');
      if (!res.ok) {
        setError('Impossible de charger vos rôles');
        setLoading(false);
        return;
      }
      const data = await res.json();
      const list: RoleOption[] = data.roles || [];

      if (list.length === 0) {
        setError('Aucun rôle attribué à votre compte. Contactez un administrateur.');
        setLoading(false);
        return;
      }

      if (list.length === 1) {
        await activate(list[0].id, true);
        return;
      }

      setRoles(list);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement des rôles');
      setLoading(false);
    }
  }

  async function activate(roleUuid: string, silent = false) {
    try {
      if (!silent) setActivatingId(roleUuid);
      await update({ activeRoleId: roleUuid });
      router.replace(next);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Impossible d\'activer ce rôle');
      setActivatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Préparation de votre espace...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              Connexion impossible
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">{error}</p>
            <Button
              variant="outline"
              onClick={() => signOut({ callbackUrl: '/auth/login', redirect: true })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-blue-50 to-purple-50">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Choisissez votre rôle</CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Bonjour {session?.user?.name}, vous disposez de plusieurs rôles. Sélectionnez celui que
            vous souhaitez utiliser.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => activate(role.id)}
                disabled={activatingId !== null}
                className="text-left p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center flex-shrink-0">
                    {activatingId === role.id ? (
                      <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    ) : (
                      <Shield className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{role.name}</p>
                    {role.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{role.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/auth/login', redirect: true })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SelectRolePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Chargement...</div>}>
      <SelectRoleInner />
    </Suspense>
  );
}
