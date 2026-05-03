'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, User as UserIcon, Shield, Check, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface RoleOption {
  id: string;
  roleId: string;
  name: string;
  description: string | null;
}

export function UserMenu() {
  const { data: session, status, update } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    fetch('/api/auth/my-roles')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setRoles(d.roles || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, (session?.user as any)?.activeRoleId]);

  if (status !== 'authenticated' || !session?.user) return null;
  if (pathname?.startsWith('/auth/')) return null;

  const name = session.user.name || session.user.email || 'Utilisateur';
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const activeRoleId = (session.user as any).activeRoleId || (session.user as any).roleId;
  const activeRole = roles.find((r) => r.id === activeRoleId);

  async function handleSwitch(roleUuid: string) {
    if (roleUuid === activeRoleId) {
      setOpen(false);
      return;
    }
    try {
      setSwitching(roleUuid);
      await update({ activeRoleId: roleUuid });
      setOpen(false);
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      console.error('Role switch failed:', err);
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div ref={ref} className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-1 pr-3 py-1 shadow-sm hover:shadow-md transition-shadow"
        aria-label="Menu utilisateur"
      >
        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
          {initials}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium text-gray-700">{name}</span>
          {activeRole && (
            <span className="text-xs text-blue-600">{activeRole.name}</span>
          )}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
            <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            {activeRole && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                <Shield className="w-3 h-3" />
                <span className="truncate">Rôle actif : {activeRole.name}</span>
              </div>
            )}
          </div>

          {roles.length > 1 && (
            <div className="py-1 border-b border-gray-100">
              <p className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Changer de rôle
              </p>
              {roles.map((role) => {
                const isActive = role.id === activeRoleId;
                const isLoading = switching === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => handleSwitch(role.id)}
                    disabled={switching !== null}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 ${
                      isActive ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Shield
                        className={`w-4 h-4 flex-shrink-0 ${
                          isActive ? 'text-blue-600' : 'text-gray-400'
                        }`}
                      />
                      <span className={`truncate ${isActive ? 'font-medium text-blue-700' : 'text-gray-700'}`}>
                        {role.name}
                      </span>
                    </span>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                    ) : isActive ? (
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="py-1">
            <a
              href="/profile"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <UserIcon className="w-4 h-4" />
              Mon profil
            </a>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login', redirect: true })}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
