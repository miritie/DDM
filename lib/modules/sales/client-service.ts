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
  taxId: string | null;
  creditLimit: number;
  currentBalance: number;
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

export interface CreateClientInput {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  creditLimit?: number;
  workspaceId: string;
}

export interface UpdateClientInput {
  name?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  creditLimit?: number;
}

export interface ClientListFilters {
  isActive?: boolean;
  search?: string;
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
  tax_id as "taxId",
  COALESCE(credit_limit, 0)::float as "creditLimit",
  COALESCE(current_balance, 0)::float as "currentBalance",
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

  /** Liste paginée / filtrée pour la page /clients. */
  async list(workspaceId: string, filters: ClientListFilters = {}): Promise<Client[]> {
    const db = getDb();
    const conds: string[] = ['workspace_id = $1'];
    const params: any[] = [workspaceId];
    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      conds.push(`is_active = $${params.length}`);
    }
    if (filters.search?.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const idx = params.length;
      conds.push(`(name ILIKE $${idx} OR phone ILIKE $${idx} OR code ILIKE $${idx} OR company_name ILIKE $${idx} OR tax_id ILIKE $${idx})`);
    }
    const r = await db.query(
      `SELECT ${SELECT_FIELDS} FROM clients WHERE ${conds.join(' AND ')} ORDER BY name ASC`,
      params
    );
    return r.rows;
  }

  /** Création complète (form admin/manager_commercial). */
  async create(input: CreateClientInput): Promise<Client> {
    const db = getDb();
    const name = input.name.trim();
    if (!name) throw new Error('Le nom est obligatoire');

    const cleanedPhone = input.phone?.replace(/\D/g, '') || null;
    if (cleanedPhone) {
      const existing = await this.findByPhone(cleanedPhone, input.workspaceId);
      if (existing) {
        throw new Error(`Un client existe déjà avec ce numéro : ${existing.name} (${existing.code})`);
      }
    }

    const countResult = await db.query(
      `SELECT COUNT(*) AS c FROM clients WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const count = parseInt(countResult.rows[0].c, 10) + 1;
    const clientCode = `CLI-${count.toString().padStart(4, '0')}`;

    const r = await db.query(
      `INSERT INTO clients
        (client_id, name, code, company_name, phone, email, address, tax_id, credit_limit, current_balance, workspace_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, true)
       RETURNING ${SELECT_FIELDS}`,
      [
        uuidv4(),
        name,
        clientCode,
        input.companyName?.trim() || null,
        cleanedPhone,
        input.email?.trim() || null,
        input.address?.trim() || null,
        input.taxId?.trim() || null,
        input.creditLimit ?? 0,
        input.workspaceId,
      ]
    );
    return r.rows[0];
  }

  async update(id: string, updates: UpdateClientInput): Promise<Client> {
    const db = getDb();
    const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [id];
    const push = (col: string, val: any) => {
      params.push(val);
      fields.push(`${col} = $${params.length}`);
    };
    if (updates.name !== undefined)        push('name',         updates.name.trim());
    if (updates.companyName !== undefined) push('company_name', updates.companyName?.trim() || null);
    if (updates.phone !== undefined)       push('phone',        updates.phone?.replace(/\D/g, '') || null);
    if (updates.email !== undefined)       push('email',        updates.email?.trim() || null);
    if (updates.address !== undefined)     push('address',      updates.address?.trim() || null);
    if (updates.taxId !== undefined)       push('tax_id',       updates.taxId?.trim() || null);
    if (updates.creditLimit !== undefined) push('credit_limit', updates.creditLimit);

    const r = await db.query(
      `UPDATE clients SET ${fields.join(', ')} WHERE id = $1 RETURNING ${SELECT_FIELDS}`,
      params
    );
    if (r.rows.length === 0) throw new Error('Client introuvable');
    return r.rows[0];
  }

  async setActive(id: string, isActive: boolean): Promise<Client> {
    const db = getDb();
    const r = await db.query(
      `UPDATE clients SET is_active = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING ${SELECT_FIELDS}`,
      [id, isActive]
    );
    if (r.rows.length === 0) throw new Error('Client introuvable');
    return r.rows[0];
  }
}
