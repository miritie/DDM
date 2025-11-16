/**
 * RBAC - Export central (CLIENT-SIDE ONLY)
 *
 * IMPORTANT: Ce fichier exporte UNIQUEMENT les éléments utilisables côté client.
 * Pour les fonctions server-side, importer directement depuis './server'
 */

// Permissions & constantes (utilisables partout)
export { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './permissions';

// Client-side hooks UNIQUEMENT
export {
  usePermissions,
  useHasPermission,
  useHasAllPermissions,
  useHasAnyPermission,
} from './use-permissions';
