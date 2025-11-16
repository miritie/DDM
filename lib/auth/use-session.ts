/**
 * Hook pour accéder à la session dans les Client Components
 */

'use client';

import { useSession as useNextAuthSession } from 'next-auth/react';

/**
 * Hook pour récupérer la session utilisateur côté client
 */
export function useSession() {
  return useNextAuthSession();
}

/**
 * Hook pour récupérer l'utilisateur courant
 */
export function useCurrentUser() {
  const { data: session } = useSession();
  return session?.user;
}

/**
 * Hook pour récupérer le userId
 */
export function useCurrentUserId() {
  const user = useCurrentUser();
  return user?.userId;
}

/**
 * Hook pour récupérer le workspaceId
 */
export function useCurrentWorkspaceId() {
  const user = useCurrentUser();
  return user?.workspaceId;
}

/**
 * Hook pour vérifier si l'utilisateur est authentifié
 */
export function useIsAuthenticated() {
  const { status } = useSession();
  return status === 'authenticated';
}
