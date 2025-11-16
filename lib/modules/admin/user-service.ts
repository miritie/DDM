/**
 * Service - Gestion des Utilisateurs (PostgreSQL)
 * Module Administration & Settings
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { User, Role } from '@/types/modules';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

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
 * Service de gestion des utilisateurs (PostgreSQL)
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
    const db = getPostgresClient();

    let query = `
      SELECT
        u.id,
        u.user_id as "UserId",
        u.email as "Email",
        u.full_name as "FullName",
        u.display_name as "DisplayName",
        u.phone as "Phone",
        u.avatar_url as "AvatarUrl",
        u.role_id as "RoleId",
        u.workspace_id as "WorkspaceId",
        u.is_active as "IsActive",
        u.last_login_at as "LastLoginAt",
        u.created_at as "CreatedAt",
        u.updated_at as "UpdatedAt",
        r.name as "RoleName"
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.workspace_id = $1
    `;

    const params: any[] = [workspaceId];
    let paramIndex = 2;

    if (filters?.roleId) {
      query += ` AND u.role_id = $${paramIndex}`;
      params.push(filters.roleId);
      paramIndex++;
    }

    if (filters?.isActive !== undefined) {
      query += ` AND u.is_active = $${paramIndex}`;
      params.push(filters.isActive);
      paramIndex++;
    }

    query += ` ORDER BY u.full_name ASC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Récupère un utilisateur par ID
   */
  async getById(userId: string): Promise<User | null> {
    const db = getPostgresClient();

    const result = await db.query(
      `SELECT
        u.id,
        u.user_id as "UserId",
        u.email as "Email",
        u.full_name as "FullName",
        u.display_name as "DisplayName",
        u.phone as "Phone",
        u.avatar_url as "AvatarUrl",
        u.role_id as "RoleId",
        u.workspace_id as "WorkspaceId",
        u.is_active as "IsActive",
        u.last_login_at as "LastLoginAt",
        u.created_at as "CreatedAt",
        u.updated_at as "UpdatedAt",
        r.name as "RoleName"
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.user_id = $1
      LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Récupère un utilisateur par email
   */
  async getByEmail(email: string): Promise<User | null> {
    const db = getPostgresClient();

    const result = await db.query(
      `SELECT
        u.id,
        u.user_id as "UserId",
        u.email as "Email",
        u.password_hash as "PasswordHash",
        u.full_name as "FullName",
        u.display_name as "DisplayName",
        u.phone as "Phone",
        u.avatar_url as "AvatarUrl",
        u.role_id as "RoleId",
        u.workspace_id as "WorkspaceId",
        u.is_active as "IsActive",
        u.last_login_at as "LastLoginAt",
        u.created_at as "CreatedAt",
        u.updated_at as "UpdatedAt",
        r.name as "RoleName"
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
      LIMIT 1`,
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Crée un nouvel utilisateur
   */
  async create(input: CreateUserInput): Promise<User> {
    const db = getPostgresClient();

    // Vérifier si l'email existe déjà
    const existingUser = await this.getByEmail(input.email);
    if (existingUser) {
      throw new Error('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(input.password, 10);

    const userId = uuidv4();

    const result = await db.query(
      `INSERT INTO users (
        user_id,
        email,
        password_hash,
        full_name,
        display_name,
        phone,
        role_id,
        workspace_id,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING
        user_id as "UserId",
        email as "Email",
        full_name as "FullName",
        display_name as "DisplayName",
        phone as "Phone",
        role_id as "RoleId",
        workspace_id as "WorkspaceId",
        is_active as "IsActive",
        created_at as "CreatedAt",
        updated_at as "UpdatedAt"`,
      [
        userId,
        input.email,
        passwordHash,
        input.fullName,
        input.displayName,
        input.phone || null,
        input.roleId,
        input.workspaceId,
        true,
      ]
    );

    return result.rows[0];
  }

  /**
   * Met à jour un utilisateur
   */
  async update(userId: string, input: UpdateUserInput): Promise<User> {
    const db = getPostgresClient();

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(input.email);
      paramIndex++;
    }
    if (input.fullName !== undefined) {
      updates.push(`full_name = $${paramIndex}`);
      params.push(input.fullName);
      paramIndex++;
    }
    if (input.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex}`);
      params.push(input.displayName);
      paramIndex++;
    }
    if (input.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(input.phone);
      paramIndex++;
    }
    if (input.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex}`);
      params.push(input.avatarUrl);
      paramIndex++;
    }
    if (input.roleId !== undefined) {
      updates.push(`role_id = $${paramIndex}`);
      params.push(input.roleId);
      paramIndex++;
    }
    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(input.isActive);
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(userId);

    const result = await db.query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING
        user_id as "UserId",
        email as "Email",
        full_name as "FullName",
        display_name as "DisplayName",
        phone as "Phone",
        avatar_url as "AvatarUrl",
        role_id as "RoleId",
        workspace_id as "WorkspaceId",
        is_active as "IsActive",
        created_at as "CreatedAt",
        updated_at as "UpdatedAt"`,
      params
    );

    return result.rows[0];
  }

  /**
   * Supprime un utilisateur
   */
  async delete(userId: string): Promise<void> {
    const db = getPostgresClient();

    await db.query('DELETE FROM users WHERE user_id = $1', [userId]);
  }

  /**
   * Change le mot de passe d'un utilisateur
   */
  async changePassword(userId: string, newPassword: string): Promise<void> {
    const db = getPostgresClient();

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [passwordHash, userId]
    );
  }
}
