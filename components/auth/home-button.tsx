'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { Home } from 'lucide-react';

const HIDDEN_PREFIXES = ['/auth/'];

/**
 * @param inline — quand true, le bouton se contente d'être un enfant de
 *   layout (utilisé dans AppTopBar). Sinon, position fixed top-left
 *   (compat legacy si quelqu'un le rend directement).
 */
export function HomeButton({ inline = false }: { inline?: boolean } = {}) {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (status !== 'authenticated') return null;
  if (!pathname) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const positioning = inline ? '' : 'fixed top-4 left-4 z-50 ';

  return (
    <button
      onClick={() => router.push('/dashboard')}
      className={`${positioning}flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-2 pr-3 py-1.5 shadow-sm hover:shadow-md hover:border-blue-400 transition-all`}
      aria-label="Retour à l'accueil"
      title="Retour à mon tableau de bord"
    >
      <span className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center">
        <Home className="w-4 h-4" />
      </span>
      <span className="hidden sm:inline text-sm font-medium text-gray-700">Accueil</span>
    </button>
  );
}
