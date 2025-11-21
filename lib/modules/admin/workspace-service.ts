/**
 * Service - Gestion des Workspaces
 * Module Administration & Settings
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { Workspace } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const postgresClient = getPostgresClient();

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Service de gestion des workspaces
 */
export class WorkspaceService {
  /**
   * Liste tous les workspaces
   */
  async list(filters?: { isActive?: boolean }): Promise<Workspace[]> {
    let filterByFormula = undefined;

    if (filters?.isActive !== undefined) {
      filterByFormula = `is_active = ${filters.isActive}`;
    }

    return await postgresClient.list<Workspace>('workspaces', {
      filterByFormula,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Recupere un workspace par ID
   */
  async getById(workspaceId: string): Promise<Workspace | null> {
    const results = await postgresClient.list<Workspace>('workspaces', {
      filterByFormula: `workspace_id = '${workspaceId}'`,
    });
    return results[0] || null;
  }

  /**
   * Recupere un workspace par slug
   */
  async getBySlug(slug: string): Promise<Workspace | null> {
    const results = await postgresClient.list<Workspace>('workspaces', {
      filterByFormula: `slug = '${slug}'`,
    });
    return results[0] || null;
  }

  /**
   * Cree un nouveau workspace
   */
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    // Verifier si le slug existe deja
    const existingWorkspace = await this.getBySlug(input.slug);
    if (existingWorkspace) {
      throw new Error('Ce slug est deja utilise');
    }

    const workspace: Partial<Workspace> = {
      WorkspaceId: uuidv4(),
      Name: input.name,
      Slug: input.slug,
      Description: input.description,
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    const created = await postgresClient.create<Workspace>('workspaces', workspace);

    return created;
  }

  /**
   * Met a jour un workspace
   */
  async update(workspaceId: string, updates: UpdateWorkspaceInput): Promise<Workspace> {
    const workspace = await this.getById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace non trouve');
    }

    // Si le slug est modifie, verifier qu'il n'existe pas deja
    if (updates.slug && updates.slug !== workspace.Slug) {
      const existingWorkspace = await this.getBySlug(updates.slug);
      if (existingWorkspace) {
        throw new Error('Ce slug est deja utilise');
      }
    }

    const records = await postgresClient.list<Workspace>('workspaces', {
      filterByFormula: `workspace_id = '${workspaceId}'`,
    });

    if (records.length === 0) {
      throw new Error('Workspace non trouve');
    }

    const recordId = records[0].id;
    if (!recordId) {
      throw new Error('ID du workspace non trouve');
    }

    // Preparer les mises a jour avec les noms de champs PascalCase
    const updateData: Record<string, any> = {
      UpdatedAt: new Date().toISOString(),
    };
    if (updates.name !== undefined) updateData.Name = updates.name;
    if (updates.slug !== undefined) updateData.Slug = updates.slug;
    if (updates.description !== undefined) updateData.Description = updates.description;
    if (updates.isActive !== undefined) updateData.IsActive = updates.isActive;

    const updated = await postgresClient.update<Workspace>('workspaces', recordId, updateData);

    return updated;
  }

  /**
   * Desactive un workspace
   */
  async deactivate(workspaceId: string): Promise<Workspace> {
    return await this.update(workspaceId, { isActive: false });
  }

  /**
   * Active un workspace
   */
  async activate(workspaceId: string): Promise<Workspace> {
    return await this.update(workspaceId, { isActive: true });
  }

  /**
   * Statistiques d'un workspace
   */
  async getStatistics(workspaceId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalRoles: number;
    totalModules: number;
  }> {
    const users = await postgresClient.list('users', {
      filterByFormula: `workspace_id = '${workspaceId}'`,
    });

    const roles = await postgresClient.list('roles', {
      filterByFormula: `workspace_id = '${workspaceId}'`,
    });

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u: any) => u.is_active).length,
      totalRoles: roles.length,
      totalModules: 9, // Nombre de modules DDM
    };
  }
}
