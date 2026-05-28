'use client';

/**
 * Cloche de notifications — bandeau haut.
 *
 * Affiche un compteur de notifications non lues, mène vers /notifications.
 * Poll toutes les 60s. Caché sur pages publiques + users non authentifiés.
 */
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

const HIDDEN_PREFIXES = ['/auth', '/checkin', '/scan'];

export function NotificationBell({ inline = false }: { inline?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { status } = useSession();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const r = await fetch('/api/notifications/inbox/unread-count', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setCount(j.data?.count ?? 0);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [status, pathname]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (status !== 'authenticated') return null;

  const positioning = inline ? 'relative' : 'fixed top-4 right-20 z-50';

  return (
    <button
      onClick={() => router.push('/inbox')}
      className={`${positioning} flex items-center justify-center w-9 h-9 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md hover:border-blue-400 transition-all`}
      title={count === 0 ? 'Aucune nouvelle notification' : `${count} notification${count > 1 ? 's' : ''} non lue${count > 1 ? 's' : ''}`}
      aria-label="Notifications"
    >
      <Bell className={`w-4 h-4 ${count > 0 ? 'text-blue-600' : 'text-gray-500'}`} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
