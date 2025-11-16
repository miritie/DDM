/**
 * RBAC - Server-side functions ONLY
 *
 * Ce fichier contient les fonctions qui utilisent la base de données
 * et ne peuvent être importées QUE dans les Server Components, API Routes, etc.
 *
 * NE JAMAIS importer ce fichier dans un Client Component!
 */

// Server-side functions
export {
  getUserPermissions,
  userHasPermission,
  userHasAllPermissions,
  userHasAnyPermission,
} from './get-permissions';

export {
  canAccess,
  canAccessAll,
  canAccessAny,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
} from './check-permission';

// Re-export permissions for convenience
export { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './permissions';
