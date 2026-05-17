/**
 * Service — Centre de notifications in-app.
 *
 * Sémantique :
 *   - 1 notification = 1 message pour 1 destinataire (pas de broadcast).
 *   - channel='in_app' par défaut. Les autres canaux (email/sms) sont gérés
 *     par d'autres services dédiés.
 *   - read_at NULL = non lu. Le badge affiche le count des non-lus.
 *
 * Les "hooks d'émission" (qui crée des notifs et quand) sont appelés par les
 * services métier (expense-request, stock-transfer, etc.) via une fonction
 * fail-safe : si l'envoi de notif plante, on log mais on ne casse pas le
 * workflow métier (le user qui clique "Approuver" ne doit pas être bloqué
 * par un souci de notif).
 */
import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();

export type NotificationCategory =
  | 'expense_approved'
  | 'expense_rejected'
  | 'expense_paid'
  | 'transfer_incoming'      // un transfert vient d'arriver, à confirmer
  | 'transfer_recalled'      // l'émetteur a rappelé une ligne
  | 'transfer_shortfall'     // écart à arbitrer (émetteur notifié)
  | 'customer_order_approved'
  | 'production_order_approved'
  | 'purchase_request_approved'
  | 'generic';

export interface CreateNotificationInput {
  workspaceId: string;
  recipientId: string;       // UUID ou business code user_id, résolu en interne
  category: NotificationCategory;
  subject: string;
  message: string;
  entityType?: string;       // ex: 'expense_request'
  entityId?: string;         // UUID de l'entité
  actionUrl?: string;        // ex: '/expenses/requests/ER-xxx'
}

export class NotificationService {

  /**
   * Crée une notification in-app. Fail-safe : log l'erreur et ne throw
   * pas si l'insertion échoue (le workflow métier ne doit pas s'écrouler
   * à cause d'une notif).
   */
  async create(input: CreateNotificationInput): Promise<{ id: string } | null> {
    try {
      // Résolution recipientId (peut être slug user_id ou UUID)
      const uR = await db.query(
        `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
        [input.recipientId]
      );
      const recipientUuid = uR.rows[0]?.id;
      if (!recipientUuid) {
        console.warn(`[notif] recipient ${input.recipientId} introuvable, notif ignorée`);
        return null;
      }

      const wR = await db.query(
        `SELECT id FROM workspaces WHERE id::text = $1 OR workspace_id = $1 LIMIT 1`,
        [input.workspaceId]
      );
      const workspaceUuid = wR.rows[0]?.id ?? input.workspaceId;

      const notifSlug = `NOTIF-${uuidv4().slice(0, 8)}`;
      const r = await db.query(
        `INSERT INTO notifications (
           notification_id, recipient_id, channel, subject, message, status,
           category, entity_type, entity_id, action_url, workspace_id
         ) VALUES ($1, $2, 'in_app', $3, $4, 'sent', $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          notifSlug, recipientUuid,
          input.subject, input.message,
          input.category, input.entityType ?? null,
          input.entityId ?? null, input.actionUrl ?? null,
          workspaceUuid,
        ]
      );
      return { id: r.rows[0].id };
    } catch (e: any) {
      console.error('[notif] échec création notification :', e.message);
      return null;
    }
  }

  /**
   * Liste paginée des notifications du destinataire (in-app).
   * Plus récentes en premier.
   */
  async listForUser(userIdOrSlug: string, opts: { onlyUnread?: boolean; limit?: number; offset?: number } = {}): Promise<any[]> {
    const uR = await db.query(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [userIdOrSlug]
    );
    const userUuid = uR.rows[0]?.id;
    if (!userUuid) return [];

    const conds: string[] = ['recipient_id = $1', "channel = 'in_app'"];
    const params: any[] = [userUuid];
    if (opts.onlyUnread) conds.push('read_at IS NULL');

    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = Math.max(opts.offset ?? 0, 0);

    const r = await db.query(
      `SELECT id, notification_id, subject, message,
              category, entity_type, entity_id, action_url,
              read_at, created_at
       FROM notifications
       WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return r.rows;
  }

  /**
   * Compte des notifications non lues pour le badge bell.
   */
  async unreadCount(userIdOrSlug: string): Promise<number> {
    const uR = await db.query(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [userIdOrSlug]
    );
    const userUuid = uR.rows[0]?.id;
    if (!userUuid) return 0;
    const r = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM notifications
       WHERE recipient_id = $1 AND channel = 'in_app' AND read_at IS NULL`,
      [userUuid]
    );
    return r.rows[0]?.n ?? 0;
  }

  /**
   * Marque une notif comme lue. Vérifie que le destinataire correspond pour
   * éviter qu'un user marque une notif qui n'est pas à lui.
   */
  async markAsRead(notifIdOrSlug: string, userIdOrSlug: string): Promise<boolean> {
    const uR = await db.query(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [userIdOrSlug]
    );
    const userUuid = uR.rows[0]?.id;
    if (!userUuid) return false;
    const r = await db.query(
      `UPDATE notifications
         SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE (id::text = $1 OR notification_id = $1)
         AND recipient_id = $2
         AND read_at IS NULL
       RETURNING id`,
      [notifIdOrSlug, userUuid]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * Marque toutes les notifs in-app du destinataire comme lues.
   */
  async markAllAsRead(userIdOrSlug: string): Promise<number> {
    const uR = await db.query(
      `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
      [userIdOrSlug]
    );
    const userUuid = uR.rows[0]?.id;
    if (!userUuid) return 0;
    const r = await db.query(
      `UPDATE notifications
         SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE recipient_id = $1 AND channel = 'in_app' AND read_at IS NULL`,
      [userUuid]
    );
    return r.rowCount ?? 0;
  }
}

// Singleton partagé
let _instance: NotificationService | null = null;
export function getNotificationService(): NotificationService {
  if (!_instance) _instance = new NotificationService();
  return _instance;
}
