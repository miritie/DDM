/**
 * Helper pour récupérer la session utilisateur côté serveur
 */

import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';
import { AuthenticationError } from '@/lib/http/api-error';

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
    // Erreur typée → handleApiError la mappe en 401 (au lieu d'un 500 legacy)
    throw new AuthenticationError('Non authentifié');
  }

  return session.user;
}

/**
 * Récupère le userId métier (varchar 'USR-…') de l'utilisateur courant.
 */
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.userId;
}

/**
 * Récupère l'UUID `users.id` de l'utilisateur courant.
 * Utile pour journaliser dans des tables dont la FK pointe sur `users.id`
 * (audit logs, créateurs, etc.) — le `user.userId` de la session est en
 * fait le business code (varchar), pas l'UUID.
 */
export async function getCurrentUserUuid(): Promise<string | null> {
  const user = await getCurrentUser();
  const businessId = (user as any).userId;
  if (!businessId) return null;
  const { getPostgresClient } = await import('@/lib/database/postgres-client');
  const r = await getPostgresClient().query(
    `SELECT id FROM users WHERE user_id = $1 OR id::text = $1 LIMIT 1`,
    [businessId]
  );
  return r.rows[0]?.id ?? null;
}

/**
 * Récupère le workspaceId de l'utilisateur courant
 */
export async function getCurrentWorkspaceId(): Promise<string> {
  const user = await getCurrentUser();
  return user.workspaceId;
}

/**
 * Récupère le rôle actif (UUID) de l'utilisateur courant
 */
export async function getCurrentActiveRoleId(): Promise<string> {
  const user = await getCurrentUser();
  return (user as any).activeRoleId || user.roleId;
}

/**
 * Récupère la liste des UUIDs de rôles disponibles pour l'utilisateur courant
 */
export async function getCurrentUserRoleIds(): Promise<string[]> {
  const user = await getCurrentUser();
  return (user as any).roleIds || [];
}

/**
 * Vérifie si l'utilisateur est authentifié
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}
