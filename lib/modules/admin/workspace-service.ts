/**
 * Service - Gestion des Workspaces
 * Module Administration & Settings
 */

import { AirtableClient } from '@/lib/airtable/client';
import { Workspace } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';

const airtableClient = new AirtableClient();

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
      filterByFormula = `{IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`;
    }

    return await airtableClient.list<Workspace>('Workspace', {
      filterByFormula,
      sort: [{ field: 'Name', direction: 'asc' }],
    });
  }

  /**
   * Récupère un workspace par ID
   */
  async getById(workspaceId: string): Promise<Workspace | null> {
    const results = await airtableClient.list<Workspace>('Workspace', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });
    return results[0] || null;
  }

  /**
   * Récupère un workspace par slug
   */
  async getBySlug(slug: string): Promise<Workspace | null> {
    const results = await airtableClient.list<Workspace>('Workspace', {
      filterByFormula: `{Slug} = '${slug}'`,
    });
    return results[0] || null;
  }

  /**
   * Crée un nouveau workspace
   */
  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    // Vérifier si le slug existe déjà
    const existingWorkspace = await this.getBySlug(input.slug);
    if (existingWorkspace) {
      throw new Error('Ce slug est déjà utilisé');
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

    return await airtableClient.create<Workspace>('Workspace', workspace);
  }

  /**
   * Met à jour un workspace
   */
  async update(workspaceId: string, updates: UpdateWorkspaceInput): Promise<Workspace> {
    const workspace = await this.getById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace non trouvé');
    }

    // Si le slug est modifié, vérifier qu'il n'existe pas déjà
    if (updates.slug && updates.slug !== workspace.Slug) {
      const existingWorkspace = await this.getBySlug(updates.slug);
      if (existingWorkspace) {
        throw new Error('Ce slug est déjà utilisé');
      }
    }

    const records = await airtableClient.list<Workspace>('Workspace', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });

    if (records.length === 0) {
      throw new Error('Workspace non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    return await airtableClient.update<Workspace>('Workspace', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Désactive un workspace
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
    const users = await airtableClient.list('User', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });

    const roles = await airtableClient.list('Role', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u: any) => u.IsActive).length,
      totalRoles: roles.length,
      totalModules: 9, // Nombre de modules DDM
    };
  }
}
