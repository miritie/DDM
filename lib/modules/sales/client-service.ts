/**
 * Service - Clients (table 'clients' liée aux ventes)
 *
 * À ne pas confondre avec lib/modules/customers/customer-service.ts qui gère
 * la table 'customers' (CRM/fidélité). Ici on travaille sur la table 'clients'
 * référencée par sales.client_id (ON DELETE SET NULL).
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

export interface Client {
  id: string;
  clientId: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  companyName: string | null;
  isActive: boolean;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickCreateClientInput {
  name?: string;
  phone?: string;
  workspaceId: string;
}

const getDb = () => getPostgresClient();

const SELECT_FIELDS = `
  id,
  client_id as "clientId",
  name,
  code,
  email,
  phone,
  address,
  company_name as "companyName",
  is_active as "isActive",
  workspace_id as "workspaceId",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

export class ClientService {
  /**
   * Cherche par téléphone exact (workspace).
   */
  async findByPhone(phone: string, workspaceId: string): Promise<Client | null> {
    const db = getDb();
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned) return null;
    const result = await db.query(
      `SELECT ${SELECT_FIELDS}
       FROM clients
       WHERE workspace_id = $1
         AND regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $2
       LIMIT 1`,
      [workspaceId, cleaned]
    );
    return result.rows[0] || null;
  }

  /**
   * Recherche plein-texte simple sur nom + téléphone (ILIKE).
   */
  async search(workspaceId: string, query: string, limit = 10): Promise<Client[]> {
    const db = getDb();
    const q = `%${query.trim()}%`;
    const result = await db.query(
      `SELECT ${SELECT_FIELDS}
       FROM clients
       WHERE workspace_id = $1
         AND is_active = true
         AND (name ILIKE $2 OR phone ILIKE $2 OR code ILIKE $2)
       ORDER BY name ASC
       LIMIT $3`,
      [workspaceId, q, limit]
    );
    return result.rows;
  }

  async getById(id: string): Promise<Client | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${SELECT_FIELDS} FROM clients WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Crée un client minimal à partir d'un nom et/ou d'un téléphone.
   * Si le téléphone existe déjà, retourne l'existant.
   */
  async quickCreate(input: QuickCreateClientInput): Promise<Client> {
    const cleanedPhone = input.phone?.replace(/\D/g, '') || null;
    const name = input.name?.trim() || (cleanedPhone ? `Client ${cleanedPhone.slice(-4)}` : null);

    if (!name && !cleanedPhone) {
      throw new Error('Nom ou téléphone requis');
    }

    if (cleanedPhone) {
      const existing = await this.findByPhone(cleanedPhone, input.workspaceId);
      if (existing) return existing;
    }

    const db = getDb();

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM clients WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const count = parseInt(countResult.rows[0].count, 10) + 1;
    const clientCode = `CLI-${count.toString().padStart(4, '0')}`;
    const businessId = uuidv4();

    const result = await db.query(
      `INSERT INTO clients (client_id, name, code, phone, workspace_id, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING ${SELECT_FIELDS}`,
      [businessId, name, clientCode, cleanedPhone, input.workspaceId]
    );

    return result.rows[0];
  }
}
