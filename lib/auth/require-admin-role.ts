/**
 * Helper - Vérifie que l'utilisateur courant a strictement le rôle admin.
 *
 * Plus strict que requirePermission(ADMIN_USERS_VIEW) ou autres proxys
 * de permission : on consulte directement roles.role_id = 'admin' via
 * jointure depuis user_roles, pour les actions vraiment réservées au
 * décideur (approbations d'achats, approbations de commandes, etc.).
 */

import { getCurrentActiveRoleId, getCurrentUserRoleIds } from './get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function requireAdminRole(): Promise<void> {
  const activeUuid = await getCurrentActiveRoleId();
  const allUuids = await getCurrentUserRoleIds();
  const toCheck = Array.from(new Set([activeUuid, ...allUuids].filter(Boolean)));
  if (toCheck.length === 0) {
    throw new Error('Permission refusée : aucun rôle actif');
  }
  const r = await db.query(
    `SELECT role_id FROM roles WHERE id = ANY($1::uuid[])`,
    [toCheck]
  );
  const isAdmin = r.rows.some((row: any) => row.role_id === 'admin');
  if (!isAdmin) {
    throw new Error("Permission refusée : seul un administrateur peut effectuer cette action.");
  }
}
