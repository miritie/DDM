/**
 * Service - Gestion des Rôles & Permissions (PostgreSQL)
 * Module Administration & Settings
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Role, Permission } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds: string[];
  workspaceId: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionIds?: string[];
  isActive?: boolean;
}

/**
 * Service de gestion des rôles et permissions (PostgreSQL)
 */
export class RoleService {
  /**
   * Liste tous les rôles
   */
  async list(
    workspaceId: string,
    filters?: {
      isActive?: boolean;
    }
  ): Promise<Role[]> {
    const db = getPostgresClient();

    let query = `
      SELECT
        r.id,
        r.role_id as "RoleId",
        r.name as "Name",
        r.description as "Description",
        r.permission_ids as "PermissionIds",
        r.workspace_id as "WorkspaceId",
        r.is_active as "IsActive",
        r.created_at as "CreatedAt",
        r.updated_at as "UpdatedAt"
      FROM roles r
      WHERE r.workspace_id = $1
    `;

    const params: any[] = [workspaceId];
    let paramIndex = 2;

    if (filters?.isActive !== undefined) {
      query += ` AND r.is_active = $${paramIndex}`;
      params.push(filters.isActive);
      paramIndex++;
    }

    query += ` ORDER BY r.name ASC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Récupère un rôle par ID
   */
  async getById(roleId: string): Promise<Role | null> {
    const db = getPostgresClient();

    const result = await db.query(
      `SELECT
        r.id,
        r.role_id as "RoleId",
        r.name as "Name",
        r.description as "Description",
        r.permission_ids as "PermissionIds",
        r.workspace_id as "WorkspaceId",
        r.is_active as "IsActive",
        r.created_at as "CreatedAt",
        r.updated_at as "UpdatedAt"
      FROM roles r
      WHERE r.role_id = $1
      LIMIT 1`,
      [roleId]
    );

    return result.rows[0] || null;
  }

  /**
   * Récupère un rôle par UUID (colonne id)
   */
  async getByUuid(uuid: string): Promise<Role | null> {
    const db = getPostgresClient();

    const result = await db.query(
      `SELECT
        r.id,
        r.role_id as "RoleId",
        r.name as "Name",
        r.description as "Description",
        r.permission_ids as "PermissionIds",
        r.workspace_id as "WorkspaceId",
        r.is_active as "IsActive",
        r.created_at as "CreatedAt",
        r.updated_at as "UpdatedAt"
      FROM roles r
      WHERE r.id = $1
      LIMIT 1`,
      [uuid]
    );

    return result.rows[0] || null;
  }

  /**
   * Crée un nouveau rôle
   */
  async create(input: CreateRoleInput): Promise<Role> {
    const db = getPostgresClient();

    // Générer un RoleId unique (format: ROLE-XXX)
    const rolesCount = await db.query(
      'SELECT COUNT(*) as count FROM roles WHERE workspace_id = $1',
      [input.workspaceId]
    );
    const count = parseInt(rolesCount.rows[0].count) + 1;
    const roleId = `ROLE-${count.toString().padStart(3, '0')}`;

    const result = await db.query(
      `INSERT INTO roles (
        role_id,
        name,
        description,
        permission_ids,
        workspace_id,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING
        id,
        role_id as "RoleId",
        name as "Name",
        description as "Description",
        permission_ids as "PermissionIds",
        workspace_id as "WorkspaceId",
        is_active as "IsActive",
        created_at as "CreatedAt",
        updated_at as "UpdatedAt"`,
      [
        roleId,
        input.name,
        input.description || '',
        input.permissionIds,
        input.workspaceId,
        true,
      ]
    );

    return result.rows[0];
  }

  /**
   * Met à jour un rôle
   */
  async update(roleId: string, input: UpdateRoleInput): Promise<Role> {
    const db = getPostgresClient();

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(input.description);
      paramIndex++;
    }
    if (input.permissionIds !== undefined) {
      updates.push(`permission_ids = $${paramIndex}`);
      params.push(input.permissionIds);
      paramIndex++;
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(input.isActive);
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(roleId);

    const result = await db.query(
      `UPDATE roles
       SET ${updates.join(', ')}
       WHERE role_id = $${paramIndex}
       RETURNING
        id,
        role_id as "RoleId",
        name as "Name",
        description as "Description",
        permission_ids as "PermissionIds",
        workspace_id as "WorkspaceId",
        is_active as "IsActive",
        created_at as "CreatedAt",
        updated_at as "UpdatedAt"`,
      params
    );

    return result.rows[0];
  }

  /**
   * Supprime un rôle
   */
  async delete(roleId: string): Promise<void> {
    const db = getPostgresClient();

    await db.query('DELETE FROM roles WHERE role_id = $1', [roleId]);
  }

  /**
   * Liste toutes les permissions disponibles
   */
  async listPermissions(): Promise<Permission[]> {
    const db = getPostgresClient();

    const result = await db.query(
      `SELECT
        permission_id as "PermissionId",
        code as "Code",
        name as "Name",
        description as "Description",
        module as "Module",
        is_active as "IsActive"
      FROM permissions
      WHERE is_active = true
      ORDER BY module, name`
    );

    return result.rows;
  }

  /**
   * Assigne des permissions à un rôle (via la table role_permissions)
   */
  async assignPermissions(roleUuid: string, permissionUuids: string[]): Promise<void> {
    const db = getPostgresClient();

    // Supprimer les permissions existantes
    await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleUuid]);

    // Ajouter les nouvelles permissions
    for (const permissionUuid of permissionUuids) {
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleUuid, permissionUuid]
      );
    }
  }

  /**
   * Récupère les permissions d'un rôle (via la table role_permissions)
   */
  async getRolePermissions(roleUuid: string): Promise<Permission[]> {
    const db = getPostgresClient();

    const result = await db.query(
      `SELECT
        p.id,
        p.permission_id as "PermissionId",
        p.code as "Code",
        p.name as "Name",
        p.description as "Description",
        p.module as "Module",
        p.is_active as "IsActive"
      FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      ORDER BY p.module, p.name`,
      [roleUuid]
    );

    return result.rows;
  }
}
