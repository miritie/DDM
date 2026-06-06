'use client';

/**
 * Page - Mon Profil
 * Identité de l'utilisateur connecté, rôles, accès rapides.
 * (Le lien « Profil » du menu utilisateur pointait vers un 404.)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { User, Shield, LogOut, ArrowLeftRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MyRole { id: string; name: string; isActive: boolean }

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [roles, setRoles] = useState<MyRole[]>([]);

  useEffect(() => {
    fetch('/api/auth/my-roles')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => {
        const list = (d.data?.roles ?? d.data ?? []) as any[];
        const activeId = d.data?.activeRoleId;
        setRoles(list.map((r: any) => ({
          id: r.id ?? r.roleId ?? r.role_id,
          name: r.name ?? r.label ?? String(r),
          isActive: activeId ? (r.id ?? r.roleId) === activeId : false,
        })));
      })
      .catch(() => {});
  }, []);

  if (status === 'loading') {
    return <div className="text-center py-24"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>;
  }

  const user = session?.user as any;

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <User className="w-7 h-7 text-amber-700" /> Mon Profil
      </h1>

      <Card>
        <CardContent className="pt-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-2xl font-bold shrink-0">
            {(user?.name || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold truncate">{user?.name || '—'}</p>
            <p className="text-sm text-gray-500 truncate">{user?.email || '—'}</p>
            {user?.userId && <p className="text-xs text-gray-400 font-mono mt-0.5">{user.userId}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-700" /> Mes rôles
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {roles.length === 0 ? (
            <p className="text-sm text-gray-500">Rôle unique (pas de bascule disponible).</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map(r => (
                <span key={r.id}
                  className={'px-3 py-1.5 rounded-full text-sm font-semibold border ' +
                    (r.isActive ? 'bg-amber-700 text-white border-amber-700' : 'bg-white border-gray-300 text-gray-700')}>
                  {r.name}{r.isActive ? ' · actif' : ''}
                </span>
              ))}
            </div>
          )}
          {roles.length > 1 && (
            <Link href="/auth/select-role"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-amber-700 font-semibold hover:underline">
              <ArrowLeftRight className="w-4 h-4" /> Changer de rôle actif
            </Link>
          )}
        </CardContent>
      </Card>

      <Link href="/auth/logout"
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100">
        <LogOut className="w-4 h-4" /> Se déconnecter
      </Link>
    </div>
  );
}
