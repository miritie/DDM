/**
 * Helper pour récupérer la session utilisateur côté serveur
 */

import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';

/**
 * Récupère la session utilisateur côté serveur (Server Components, API Routes)
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Récupère l'utilisateur courant ou throw une erreur si non authentifié
 */
export async function getCurrentUser() {
  const session = await getSession();

  if (!session || !session.user) {
    throw new Error('Non authentifié');
  }

  return session.user;
}

/**
 * Récupère le userId de l'utilisateur courant
 */
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.userId;
}

/**
 * Récupère le workspaceId de l'utilisateur courant
 */
export async function getCurrentWorkspaceId(): Promise<string> {
  const user = await getCurrentUser();
  return user.workspaceId;
}

/**
 * Vérifie si l'utilisateur est authentifié
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}
