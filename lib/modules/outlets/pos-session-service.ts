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
    input: { cashCounted: number; cashWalletId?: string | null; closedByUserUuid: string; notes?: string }
  ): Promise<PosSession & { CashExpected: number; CashCounted: number; Discrepancy: number }> {
    // Primes du jour (transport + vente) versées en espèces au vendeur
    // AVANT le comptage : elles sortent du tiroir et entrent dans le
    // cash attendu via getSessionCashSummary. Best-effort : un échec de
    // primes ne bloque pas la clôture.
    let payouts: any = null;
    try {
      const { CommissionPayoutService } = await import('@/lib/modules/hr/commission-payout-service');
      payouts = await new CommissionPayoutService().payForSession(sessionId, input.closedByUserUuid);
    } catch (e: any) {
      console.warn('[close-cash] primes non versées:', e.message);
    }

    // Source de vérité : le calcul de session (ventes cash − dépôts cash
    // − primes versées), pas le solde wallet cumulé. Le wallet n'est
    // utilisé que pour l'audit si fourni (et n'est PAS modifié — la
    // discordance n'applique aucune correction automatique).
    const summary = await this.getSessionCashSummary(sessionId);
    const expected = summary.expected;
    const counted = Number(input.cashCounted);
    const discrepancy = counted - expected;

    const r = await db.query(
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
      ...(payouts ? { CommissionPayouts: payouts } : {}),
    } as any;
  }

/**
   * Cash attendu d'une session POS.
   *
   * Calcul faisant autorité (ne dépend PAS du solde wallet, qui est cumulé
   * sur toute l'histoire et donc incohérent comme « cash de session ») :
   *
   *   cash_in  = SUM(sale_payments.amount) pour cette session,
   *              méthode = 'cash', vente non annulée
   *   cash_out = SUM(cash_deposits.amount) faits sur l'outlet
   *              pendant la fenêtre [started_at … ended_at|now]
   *   expected = cash_in − cash_out
   *
   * On suppose un fond de caisse d'ouverture à 0 (V1). Si un fond initial
   * est introduit plus tard, l'ajouter ici.
   */
  async getSessionCashSummary(sessionId: string): Promise<{
    sessionId: string;
    outletId: string;
    startedAt: string;
    endedAt: string | null;
    cashIn: number;
    cashOut: number;
    expected: number;
  }> {
    const sRes = await db.query<any>(
      `SELECT id, outlet_id, started_at, ended_at
       FROM pos_sessions WHERE id = $1 LIMIT 1`,
      [sessionId]
    );
    if (sRes.rows.length === 0) throw new Error('Session introuvable');
    const s = sRes.rows[0];

    const cashInRes = await db.query<any>(
      `SELECT COALESCE(SUM(sp.amount), 0)::float AS total
       FROM sale_payments sp
       JOIN sales sa ON sa.id = sp.sale_id
       JOIN payment_methods pm ON pm.id = sp.payment_method_id
       WHERE sa.pos_session_id = $1
         AND pm.code = 'cash'
         AND sa.status <> 'cancelled'`,
      [sessionId]
    );
    const cashOutRes = await db.query<any>(
      `SELECT COALESCE(SUM(cd.amount), 0)::float AS total
       FROM cash_deposits cd
       WHERE cd.outlet_id = $1
         AND cd.deposited_at >= $2
         AND cd.deposited_at <= COALESCE($3::timestamp, CURRENT_TIMESTAMP)`,
      [s.outlet_id, s.started_at, s.ended_at]
    );
    // Primes commerciaux versées en espèces depuis cette session (Z-out)
    let payoutsOut = 0;
    try {
      const payoutsRes = await db.query<any>(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM commission_payouts WHERE pos_session_id = $1`,
        [sessionId]
      );
      payoutsOut = Number(payoutsRes.rows[0].total);
    } catch { /* table absente tant que le module paie n'a pas tourné */ }
    const cashIn = Number(cashInRes.rows[0].total);
    const cashOut = Number(cashOutRes.rows[0].total) + payoutsOut;
    return {
      sessionId: s.id,
      outletId: s.outlet_id,
      startedAt: s.started_at?.toISOString?.() ?? s.started_at,
      endedAt: s.ended_at ? (s.ended_at.toISOString?.() ?? s.ended_at) : null,
      cashIn, cashOut, expected: cashIn - cashOut,
    };
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
