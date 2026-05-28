'use client';

/**
 * Badge alerte transferts à recevoir — affiché dans le bandeau haut.
 *
 * Apparaît seulement si au moins 1 ligne 'pending' dans le workspace.
 * Clic → /stock/transfers (onglet "À recevoir" actif par défaut).
 *
 * Caché sur pages publiques + users sans stock:view.
 */
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRightLeft } from 'lucide-react';
import { usePermissions } from '@/lib/rbac/use-permissions';
import { PERMISSIONS } from '@/lib/rbac';

const HIDDEN_PREFIXES = ['/auth', '/checkin', '/scan'];

export function TransferAlertBadge({ inline = false }: { inline?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { status } = useSession();
  const { permissions, loading: permLoading } = usePermissions();
  const [count, setCount] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (permLoading) return;
    if (!permissions.includes(PERMISSIONS.STOCK_VIEW)) return;

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const r = await fetch('/api/dashboard/transfer-alerts', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) {
          setCount(j.data?.pendingLegs ?? 0);
          setLoaded(true);
        }
      } catch {}
    };
    fetchCount();
    // Rafraîchit toutes les 60s
    const interval = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [status, permLoading, permissions]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (status !== 'authenticated') return null;
  if (permLoading) return null;
  if (!permissions.includes(PERMISSIONS.STOCK_VIEW)) return null;
  if (!loaded || count === 0) return null;
  if (pathname.startsWith('/stock/transfers')) return null;

  const positioning = inline ? '' : 'fixed top-4 right-44 z-50 ';

  return (
    <button
      onClick={() => router.push('/stock/transfers')}
      className={`${positioning}flex items-center gap-1.5 bg-amber-500 text-white rounded-full pl-2 pr-3 py-1.5 shadow-md hover:bg-amber-600 active:scale-95 transition-all`}
      title={`${count} ligne(s) de transfert à réceptionner`}
      aria-label={`${count} transferts à recevoir`}
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
        <ArrowRightLeft className="w-3.5 h-3.5" />
      </div>
      <span className="text-xs font-semibold">{count}</span>
      <span className="text-xs hidden md:inline opacity-90">à recevoir</span>
    </button>
  );
}
