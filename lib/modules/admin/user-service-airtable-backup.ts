/**
 * Service - Gestion des Utilisateurs
 * Module Administration & Settings
 */

import { AirtableClient } from '@/lib/airtable/client';
import { User, Role } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const airtableClient = new AirtableClient();

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  displayName: string;
  phone?: string;
  roleId: string;
  workspaceId: string;
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
  displayName?: string;
  phone?: string;
  avatarUrl?: string;
  roleId?: string;
  isActive?: boolean;
}

/**
 * Service de gestion des utilisateurs
 */
export class UserService {
  /**
   * Liste tous les utilisateurs
   */
  async list(
    workspaceId: string,
    filters?: {
      roleId?: string;
      isActive?: boolean;
    }
  ): Promise<User[]> {
    let formula = `{WorkspaceId} = '${workspaceId}'`;

    if (filters?.roleId) {
      formula += `, {RoleId} = '${filters.roleId}'`;
    }
    if (filters?.isActive !== undefined) {
      formula += `, {IsActive} = ${filters.isActive ? 'TRUE()' : 'FALSE()'}`;
    }

    return await airtableClient.list<User>('User', {
      filterByFormula: `AND(${formula})`,
      sort: [{ field: 'FullName', direction: 'asc' }],
    });
  }

  /**
   * Récupère un utilisateur par ID
   */
  async getById(userId: string): Promise<User | null> {
    const results = await airtableClient.list<User>('User', {
      filterByFormula: `{UserId} = '${userId}'`,
    });
    return results[0] || null;
  }

  /**
   * Récupère un utilisateur par email
   */
  async getByEmail(email: string): Promise<User | null> {
    const results = await airtableClient.list<User>('User', {
      filterByFormula: `{Email} = '${email}'`,
    });
    return results[0] || null;
  }

  /**
   * Crée un nouvel utilisateur
   */
  async create(input: CreateUserInput): Promise<User> {
    // Vérifier si l'email existe déjà
    const existingUser = await this.getByEmail(input.email);
    if (existingUser) {
      throw new Error('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(input.password, 10);

    const user: Partial<User> = {
      UserId: uuidv4(),
      Email: input.email,
      PasswordHash: passwordHash,
      FullName: input.fullName,
      DisplayName: input.displayName,
      Phone: input.phone,
      RoleId: input.roleId,
      WorkspaceId: input.workspaceId,
      IsActive: true,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };

    return await airtableClient.create<User>('User', user);
  }

  /**
   * Met à jour un utilisateur
   */
  async update(userId: string, updates: UpdateUserInput): Promise<User> {
    const user = await this.getById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Si l'email est modifié, vérifier qu'il n'est pas déjà utilisé
    if (updates.email && updates.email !== user.Email) {
      const existingUser = await this.getByEmail(updates.email);
      if (existingUser) {
        throw new Error('Cet email est déjà utilisé');
      }
    }

    const records = await airtableClient.list<User>('User', {
      filterByFormula: `{UserId} = '${userId}'`,
    });

    if (records.length === 0) {
      throw new Error('Utilisateur non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    return await airtableClient.update<User>('User', recordId, {
      ...updates,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Change le mot de passe d'un utilisateur
   */
  async changePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const records = await airtableClient.list<User>('User', {
      filterByFormula: `{UserId} = '${userId}'`,
    });

    if (records.length === 0) {
      throw new Error('Utilisateur non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    await airtableClient.update<User>('User', recordId, {
      PasswordHash: passwordHash,
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Désactive un utilisateur
   */
  async deactivate(userId: string): Promise<User> {
    return await this.update(userId, { isActive: false });
  }

  /**
   * Active un utilisateur
   */
  async activate(userId: string): Promise<User> {
    return await this.update(userId, { isActive: true });
  }

  /**
   * Met à jour la date de dernière connexion
   */
  async updateLastLogin(userId: string): Promise<void> {
    const records = await airtableClient.list<User>('User', {
      filterByFormula: `{UserId} = '${userId}'`,
    });

    if (records.length === 0) {
      throw new Error('Utilisateur non trouvé');
    }

    const recordId = (records[0] as any)._recordId;

    await airtableClient.update<User>('User', recordId, {
      LastLoginAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Supprime un utilisateur (soft delete)
   */
  async delete(userId: string): Promise<void> {
    await this.deactivate(userId);
  }

  /**
   * Statistiques des utilisateurs
   */
  async getStatistics(workspaceId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByRole: Array<{
      roleId: string;
      roleName: string;
      count: number;
    }>;
  }> {
    const users = await this.list(workspaceId);
    const roles = await airtableClient.list<Role>('Role', {
      filterByFormula: `{WorkspaceId} = '${workspaceId}'`,
    });

    const activeUsers = users.filter((u) => u.IsActive).length;
    const inactiveUsers = users.filter((u) => !u.IsActive).length;

    const usersByRole = roles.map((role) => ({
      roleId: role.RoleId,
      roleName: role.Name,
      count: users.filter((u) => u.RoleId === role.RoleId).length,
    }));

    return {
      totalUsers: users.length,
      activeUsers,
      inactiveUsers,
      usersByRole,
    };
  }
}
