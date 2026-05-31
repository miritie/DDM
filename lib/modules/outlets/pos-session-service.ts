/**
 * Service - Sessions POS
 *
 * Une session POS = un commercial actif sur un outlet à un moment T.
 * Sur un même outlet, plusieurs commerciaux ont chacun leur propre session
 * (donc 3 vendeurs sur un stand = 3 sessions ouvertes simultanément).
 *
 * Modes d'ouverture :
 *  - explicite : le commercial clique "Je prends mon poste"
 *  - implicite : créée automatiquement à la 1re vente du jour si aucune n'est ouverte
 * Les deux capturent le GPS pour servir de pointage de présence.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { PosSession, PosSessionStartMethod } from '@/types/modules';

const db = getPostgresClient();

export interface OpenSessionInput {
  workspaceId: string;
  outletId: string;
  userId: string;
  startMethod?: PosSessionStartMethod;
  deviceId?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
  notes?: string;
}

/** Accepte UUID PK ou business code user_id et retourne l'UUID PK. */
async function resolveUserUuid(idOrSlug: string): Promise<string> {
  const r = await db.query(
    `SELECT id FROM users WHERE id::text = $1 OR user_id = $1 LIMIT 1`,
    [idOrSlug]
  );
  if (r.rows.length === 0) throw new Error('Utilisateur introuvable');
  return r.rows[0].id;
}

export class PosSessionService {
  /** Récupère la session active (non fermée) pour (outlet, user). */
  async getActiveSession(outletId: string, userId: string): Promise<PosSession | null> {
    // userId peut être business code (USR-…) — résolution avant WHERE id UUID.
    const userUuid = await resolveUserUuid(userId);
    const r = await db.query(
      `SELECT * FROM pos_sessions
       WHERE outlet_id = $1 AND user_id = $2 AND ended_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [outletId, userUuid]
    );
    return r.rows.length > 0 ? mapRow(r.rows[0]) : null;
  }

  /** Sessions actives pour un outlet (utile pour voir qui vend en ce moment). */
  async listActiveByOutlet(outletId: string): Promise<PosSession[]> {
    const r = await db.query(
      `SELECT * FROM pos_sessions
       WHERE outlet_id = $1 AND ended_at IS NULL
       ORDER BY started_at DESC`,
      [outletId]
    );
    return r.rows.map(mapRow);
  }

  /** Sessions d'un commercial sur une plage (pointage). */
  async listByUser(userId: string, range: { from?: string; to?: string } = {}): Promise<PosSession[]> {
    const params: any[] = [userId];
    let sql = `SELECT * FROM pos_sessions WHERE user_id = $1`;
    if (range.from) { params.push(range.from); sql += ` AND started_at >= $${params.length}`; }
    if (range.to)   { params.push(range.to);   sql += ` AND started_at <= $${params.length}`; }
    sql += ` ORDER BY started_at DESC`;
    const r = await db.query(sql, params);
    return r.rows.map(mapRow);
  }

  /** Ouvre une session. Si une est déjà active pour ce (outlet, user), la renvoie. */
  async open(input: OpenSessionInput): Promise<PosSession> {
    // userId peut être business code — résolu une fois et réutilisé partout.
    const userUuid = await resolveUserUuid(input.userId);

    const existing = await this.getActiveSession(input.outletId, userUuid);
    if (existing) return existing;

    // Casts explicites : sans config GPS (cas web desktop ou refus permission),
    // gps_lat/lng/accuracy sont null et device_id/notes aussi. pg ne peut
    // alors pas inférer le type → erreur « could not determine data type
    // of parameter $5 » bloquante au tout premier encaissement.
    const r = await db.query(
      `INSERT INTO pos_sessions
        (outlet_id, user_id, start_method, device_id,
         gps_lat, gps_lng, gps_accuracy, gps_captured_at,
         notes, workspace_id)
       VALUES ($1::uuid, $2::uuid, $3, $4::varchar,
               $5::numeric, $6::numeric, $7::numeric,
               CASE WHEN $5::numeric IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
               $8::text, $9::uuid)
       RETURNING *`,
      [
        input.outletId,
        userUuid,
        input.startMethod ?? 'explicit',
        input.deviceId ?? null,
        input.gpsLat ?? null,
        input.gpsLng ?? null,
        input.gpsAccuracy ?? null,
        input.notes ?? null,
        input.workspaceId,
      ]
    );
    return mapRow(r.rows[0]);
  }

  /**
   * Garantit qu'une session existe pour la 1re vente du jour (mode implicite).
   * Renvoie la session active courante ou en ouvre une avec start_method='implicit'.
   */
  async ensureForSale(outletId: string, userId: string, workspaceId: string): Promise<PosSession> {
    const active = await this.getActiveSession(outletId, userId);
    if (active) return active;
    return this.open({ outletId, userId, workspaceId, startMethod: 'implicit' });
  }

  /** Ferme une session. */
  async close(sessionId: string, notes?: string): Promise<PosSession> {
    const r = await db.query(
      `UPDATE pos_sessions
       SET ended_at = CURRENT_TIMESTAMP,
           notes = COALESCE($2::text, notes)
       WHERE id = $1 AND ended_at IS NULL
       RETURNING *`,
      [sessionId, notes ?? null]
    );
    if (r.rows.length === 0) throw new Error('Session introuvable ou déjà fermée');
    return mapRow(r.rows[0]);
  }

  /**
   * Fermeture de caisse formelle (Z-out) : enregistre le cash physiquement
   * compté par le vendeur et la discordance par rapport au solde attendu
   * (= balance du wallet caisse à cet instant). Trace qui a clôturé.
   *
   * Atomique : SELECT FOR UPDATE du wallet pour figer le solde, puis
   * UPDATE pos_sessions dans la même transaction.
   */
  async closeWithCashCount(
    sessionId: string,
    input: { cashCounted: number; cashWalletId: string; closedByUserUuid: string; notes?: string }
  ): Promise<PosSession & { CashExpected: number; CashCounted: number; Discrepancy: number }> {
    return await db.transaction(async (client) => {
      const walletRes = await client.query<any>(
        `SELECT balance FROM wallets WHERE id = $1 FOR UPDATE`,
        [input.cashWalletId]
      );
      if (walletRes.rows.length === 0) throw new Error('Wallet caisse introuvable');
      const expected = Number(walletRes.rows[0].balance);
      const counted = Number(input.cashCounted);
      const discrepancy = counted - expected;

      const r = await client.query(
        `UPDATE pos_sessions
         SET ended_at = CURRENT_TIMESTAMP,
             closing_cash_expected = $2,
             closing_cash_counted = $3,
             closing_discrepancy = $4,
             closed_by_id = $5::uuid,
             notes = COALESCE($6::text, notes)
         WHERE id = $1 AND ended_at IS NULL
         RETURNING *`,
        [sessionId, expected, counted, discrepancy, input.closedByUserUuid, input.notes ?? null]
      );
      if (r.rows.length === 0) throw new Error('Session introuvable ou déjà fermée');
      const row = r.rows[0];
      return {
        ...mapRow(row),
        CashExpected: Number(row.closing_cash_expected),
        CashCounted: Number(row.closing_cash_counted),
        Discrepancy: Number(row.closing_discrepancy),
      };
    });
  }

  /** Auto-ferme toutes les sessions actives ouvertes depuis plus de N heures (housekeeping). */
  async autoCloseStale(maxOpenHours = 12): Promise<number> {
    const r = await db.query(
      `UPDATE pos_sessions
       SET ended_at = CURRENT_TIMESTAMP,
           notes = COALESCE(notes || ' | ', '') || 'auto-closed (stale)'
       WHERE ended_at IS NULL
         AND started_at < (CURRENT_TIMESTAMP - ($1 || ' hours')::interval)`,
      [String(maxOpenHours)]
    );
    return r.rowCount ?? 0;
  }
}

function mapRow(r: any): PosSession {
  return {
    id: r.id,
    OutletId: r.outlet_id,
    UserId: r.user_id,
    StartedAt: r.started_at?.toISOString?.() ?? r.started_at,
    EndedAt: r.ended_at ? (r.ended_at.toISOString?.() ?? r.ended_at) : undefined,
    StartMethod: r.start_method,
    DeviceId: r.device_id ?? undefined,
    GpsLat: r.gps_lat !== null ? Number(r.gps_lat) : undefined,
    GpsLng: r.gps_lng !== null ? Number(r.gps_lng) : undefined,
    GpsAccuracy: r.gps_accuracy !== null ? Number(r.gps_accuracy) : undefined,
    GpsCapturedAt: r.gps_captured_at ? (r.gps_captured_at.toISOString?.() ?? r.gps_captured_at) : undefined,
    Notes: r.notes ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}
