'use client';

/**
 * Bouton flottant — Sollicitation rapide de dépense.
 *
 * Visible partout dans l'app pour tout utilisateur authentifié qui dispose
 * de la permission expense:create. Mène à /expenses/requests/quick où il
 * ne verra que les catégories accessibles à ses rôles (filtrage backend
 * via ExpenseCategoryService.listAccessibleForUser).
 *
 * Placement : fixé au centre-haut, complète <HomeButton> (top-left) et
 * <UserMenu> (top-right) du RootLayout.
 *
 * Caché sur :
 *  - les pages publiques /auth/* et /checkin/* (session pas encore prête)
 *  - les utilisateurs non authentifiés ou sans permission
 */
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/lib/rbac/use-permissions';
import { PERMISSIONS } from '@/lib/rbac';

const HIDDEN_PREFIXES = ['/auth', '/checkin', '/scan'];

export function QuickExpenseButton({ inline = false }: { inline?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { status } = useSession();
  const { permissions, loading } = usePermissions();

  // Pages publiques → ne pas afficher
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  // Pas encore authentifié → ne pas afficher
  if (status !== 'authenticated') return null;
  if (loading) return null;
  // Permission requise
  if (!permissions.includes(PERMISSIONS.EXPENSE_CREATE)) return null;
  // Sur la page elle-même → inutile
  if (pathname.startsWith('/expenses/requests/quick')) return null;

  const positioning = inline ? '' : 'fixed top-4 left-1/2 -translate-x-1/2 z-50 ';

  return (
    <button
      onClick={() => router.push('/expenses/requests/quick')}
      className={`${positioning}flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full pl-2 pr-3 py-1.5 shadow-md hover:shadow-lg active:scale-95 transition-all`}
      title="Solliciter une dépense"
      aria-label="Solliciter une dépense"
    >
      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
        <Plus className="w-3.5 h-3.5" />
      </div>
      <span className="text-xs font-semibold hidden sm:inline">Dépense</span>
    </button>
  );
}
