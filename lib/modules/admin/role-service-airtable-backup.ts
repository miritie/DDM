/**
 * Service - Gestion des Rôles & Permissions
 * Module Administration & Settings
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Role, Permission } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
 * Service de gestion des rôles et permissions
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
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.isActive !== undefined) {
      formula += `, {IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`;
    }

    return await airtableClient.list<Role>('Role', {
      filterByFormula: `AND(${formula})`,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Récupère un rôle par ID
   */
  async getById(roleId: string): Promise<Role | null> {
    const results = await airtableClient.list<Role>('Role', {
      filterByFormula: `{RoleId} = '${roleId}'`,
    });
    return results[0] || null;
  }

  /**
   * Crée un nouveau rôle
   */
  async create(input: CreateRoleInput): Promise<Role> {
    // Vérifier si le nom existe déjà
    const existingRoles = await this.list(input.workspaceId);
    if (existingRoles.some((r) => r.Name.toLowerCase() === input.name.toLowerCase())) {
      throw new Error('Un rôle avec ce nom existe déjà');
    }

    const role: Partial<Role> = {
      RoleId: uuidv4(),
      Name: input.name,
      Description: input.description,
      PermissionIds: input.permissionIds,
      WorkspaceId: input.workspaceId,
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<Role>('Role', role);
  }

  /**
   * Met à jour un rôle
   */
  async update(roleId: string, updates: UpdateRoleInput): Promise<Role> {
    const role = await this.getById(roleId);
    if (!role) {
      throw new Error('Rôle non trouvé');
    }

    // Si le nom est modifié, vérifier qu'il n'existe pas déjà
    if (updates.name && updates.name !== role.Name) {
      const existingRoles = await this.list(role.WorkspaceId);
      if (existingRoles.some((r) => r.Name.toLowerCase() === updates.name!.toLowerCase())) {
        throw new Error('Un rôle avec ce nom existe déjà');
      }
    }

    const records = await airtableClient.list<Role>('Role', {
      filterByFormula: `{RoleId} = '${roleId}'`,
    });

    if (records.length === 0) {
      throw new Error('Rôle non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    return await airtableClient.update<Role>('Role', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Désactive un rôle
   */
  async deactivate(roleId: string): Promise<Role> {
    return await this.update(roleId, { isActive: false });
  }

  /**
   * Active un rôle
   */
  async activate(roleId: string): Promise<Role> {
    return await this.update(roleId, { isActive: true });
  }

  /**
   * Supprime un rôle (soft delete)
   */
  async delete(roleId: string): Promise<void> {
    // Vérifier qu'aucun utilisateur n'utilise ce rôle
    const users = await airtableClient.list('User', {
      filterByFormula: `{RoleId} = '${roleId}'`,
    });

    if (users.length > 0) {
      throw new Error('Impossible de supprimer ce rôle car des utilisateurs l\'utilisent');
    }

    await this.deactivate(roleId);
  }

  /**
   * Liste toutes les permissions disponibles
   */
  async listPermissions(): Promise<Permission[]> {
    return await airtableClient.list<Permission>('Permission', {
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Récupère les permissions d'un rôle
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const role = await this.getById(roleId);
    if (!role) {
      throw new Error('Rôle non trouvé');
    }

    const allPermissions = await this.listPermissions();
    return allPermissions.filter((p) => role.PermissionIds.includes(p.PermissionId));
  }

  /**
   * Ajoute une permission à un rôle
   */
  async addPermission(roleId: string, permissionId: string): Promise<Role> {
    const role = await this.getById(roleId);
    if (!role) {
      throw new Error('Rôle non trouvé');
    }

    if (role.PermissionIds.includes(permissionId)) {
      throw new Error('Cette permission est déjà associée au rôle');
    }

    const updatedPermissionIds = [...role.PermissionIds, permissionId];
    return await this.update(roleId, { permissionIds: updatedPermissionIds });
  }

  /**
   * Retire une permission d'un rôle
   */
  async removePermission(roleId: string, permissionId: string): Promise<Role> {
    const role = await this.getById(roleId);
    if (!role) {
      throw new Error('Rôle non trouvé');
    }

    const updatedPermissionIds = role.PermissionIds.filter((id) => id !== permissionId);
    return await this.update(roleId, { permissionIds: updatedPermissionIds });
  }

  /**
   * Statistiques des rôles
   */
  async getStatistics(workspaceId: string): Promise<{
    totalRoles: number;
    activeRoles: number;
    totalPermissions: number;
    rolesWithUsers: Array<{
      roleId: string;
      roleName: string;
      userCount: number;
      permissionCount: number;
    }>;
  }> {
    const roles = await this.list(workspaceId);
    const permissions = await this.listPermissions();
    const users = await airtableClient.list('User', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });

    const rolesWithUsers = roles.map((role) => ({
      roleId: role.RoleId,
      roleName: role.Name,
      userCount: users.filter((u: any) => u.RoleId === role.RoleId).length,
      permissionCount: role.PermissionIds.length,
    }));

    return {
      totalRoles: roles.length,
      activeRoles: roles.filter((r) => r.IsActive).length,
      totalPermissions: permissions.length,
      rolesWithUsers,
    };
  }
}
