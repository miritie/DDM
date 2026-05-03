/**
 * Service - Sessions de check-in client (pairing QR ↔ POS)
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { randomBytes } from 'crypto';
import { ClientService } from './client-service';

export interface CheckinSession {
  token: string;
  workspaceId: string;
  status: 'pending' | 'completed' | 'expired';
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
}

const TTL_MINUTES = 10;

const getDb = () => getPostgresClient();

const SELECT_FIELDS = `
  token,
  workspace_id as "workspaceId",
  status,
  client_id as "clientId",
  client_name as "clientName",
  client_phone as "clientPhone",
  created_at as "createdAt",
  completed_at as "completedAt",
  expires_at as "expiresAt"
`;

export class CheckinService {
  async create(workspaceId: string): Promise<CheckinSession> {
    const db = getDb();
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

    const result = await db.query(
      `INSERT INTO checkin_sessions (token, workspace_id, expires_at)
       VALUES ($1, $2, $3)
       RETURNING ${SELECT_FIELDS}`,
      [token, workspaceId, expiresAt]
    );
    return result.rows[0];
  }

  /**
   * Récupère la session, marque expirée si dépassée.
   */
  async get(token: string): Promise<CheckinSession | null> {
    const db = getDb();
    const result = await db.query(
      `SELECT ${SELECT_FIELDS} FROM checkin_sessions WHERE token = $1`,
      [token]
    );
    const session = result.rows[0];
    if (!session) return null;

    if (
      session.status === 'pending' &&
      new Date(session.expiresAt).getTime() < Date.now()
    ) {
      await db.query(
        `UPDATE checkin_sessions SET status = 'expired' WHERE token = $1`,
        [token]
      );
      session.status = 'expired';
    }

    return session;
  }

  /**
   * Le client soumet ses infos (côté public, sans auth).
   * Crée ou retrouve un client dans la table 'clients', met à jour la session.
   *
   * Si existingClientId est fourni, on rattache directement la session à ce client
   * (cas du client revenant, reconnu via cookie côté navigateur).
   */
  async complete(
    token: string,
    input: { name?: string; phone?: string; existingClientId?: string }
  ): Promise<CheckinSession> {
    const session = await this.get(token);
    if (!session) throw new Error('Session introuvable');
    if (session.status === 'expired') throw new Error('Session expirée');
    if (session.status === 'completed') return session;

    const clientService = new ClientService();
    let client: { id: string; name: string; phone: string | null } | null = null;

    if (input.existingClientId) {
      const found = await clientService.getById(input.existingClientId);
      if (found && found.workspaceId === session.workspaceId) {
        client = { id: found.id, name: found.name, phone: found.phone };
      }
    }

    if (!client) {
      const cleanedPhone = input.phone?.replace(/\D/g, '') || null;
      const name = input.name?.trim() || null;
      if (!cleanedPhone && !name) {
        throw new Error('Nom ou téléphone requis');
      }
      const created = await clientService.quickCreate({
        name: name ?? undefined,
        phone: cleanedPhone ?? undefined,
        workspaceId: session.workspaceId,
      });
      client = { id: created.id, name: created.name, phone: created.phone };
    }

    const db = getDb();
    const result = await db.query(
      `UPDATE checkin_sessions
       SET status = 'completed',
           client_id = $1,
           client_name = $2,
           client_phone = $3,
           completed_at = CURRENT_TIMESTAMP
       WHERE token = $4
       RETURNING ${SELECT_FIELDS}`,
      [client.id, client.name, client.phone, token]
    );
    return result.rows[0];
  }
}
