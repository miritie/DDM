'use client';

/**
 * Badge bandeau — Mes demandes de dépense en cours.
 *
 * Apparaît dès qu'au moins une demande du user est en attente (statut
 * submitted / approved / scheduled). Clic → /expenses/my-requests pour
 * voir la timeline détaillée.
 *
 * Caché sur pages publiques + users sans expense:create.
 */
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { usePermissions } from '@/lib/rbac/use-permissions';
import { PERMISSIONS } from '@/lib/rbac';

const HIDDEN_PREFIXES = ['/auth', '/checkin', '/scan'];

export function MyExpensesAlertBadge() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { status } = useSession();
  const { permissions, loading: permLoading } = usePermissions();
  const [count, setCount] = useState<number>(0);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (permLoading) return;
    if (!permissions.includes(PERMISSIONS.EXPENSE_CREATE)) return;

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const r = await fetch('/api/expenses/my-pending-count', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) {
          setCount(j.data?.total ?? 0);
          setByStatus(j.data?.byStatus ?? {});
          setLoaded(true);
        }
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [status, permLoading, permissions]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (status !== 'authenticated') return null;
  if (permLoading) return null;
  if (!permissions.includes(PERMISSIONS.EXPENSE_CREATE)) return null;
  if (!loaded || count === 0) return null;
  if (pathname.startsWith('/expenses/my-requests')) return null;

  // Détail pour le tooltip
  const parts: string[] = [];
  if (byStatus.submitted) parts.push(`${byStatus.submitted} à valider`);
  if (byStatus.approved) parts.push(`${byStatus.approved} à payer`);
  if (byStatus.scheduled) parts.push(`${byStatus.scheduled} planifiée(s)`);
  const tooltip = parts.length > 0 ? parts.join(' · ') : `${count} en cours`;

  return (
    <button
      onClick={() => router.push('/expenses/my-requests')}
      className="fixed top-4 right-60 z-50 flex items-center gap-2 bg-blue-500 text-white rounded-full pl-3 pr-4 py-2 shadow-lg hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all"
      title={tooltip}
      aria-label={`${count} demande(s) de dépense en cours : ${tooltip}`}
    >
      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
        <Receipt className="w-4 h-4" />
      </div>
      <span className="text-sm font-semibold">{count}</span>
      <span className="text-xs hidden sm:inline opacity-90">mes dépenses</span>
    </button>
  );
}
