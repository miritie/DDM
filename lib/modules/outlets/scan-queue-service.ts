/**
 * Service - File de scans clients en attente d'attribution
 *
 * Quand un client scanne le QR du stand :
 *  - Une entrée est créée dans pending_client_scans (TTL ~10 min)
 *  - Côté POS, le commercial voit la file des clients qui viennent de scanner
 *  - Au moment d'encaisser, il sélectionne le bon client (ou pré-sélection automatique
 *    sur le scan le plus récent s'il n'y en a qu'un)
 *  - Une fois la vente encaissée, le scan est marqué consumed (lien sale_id)
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { PendingClientScan } from '@/types/modules';

const db = getPostgresClient();

const DEFAULT_TTL_MINUTES = 10;

export interface PushScanInput {
  workspaceId: string;
  outletId: string;
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  ttlMinutes?: number;
}

export class ScanQueueService {
  /** Enregistre un scan client sur un outlet. */
  async push(input: PushScanInput): Promise<PendingClientScan> {
    const ttl = input.ttlMinutes ?? DEFAULT_TTL_MINUTES;
    const r = await db.query(
      `INSERT INTO pending_client_scans
        (outlet_id, client_id, client_name, client_phone,
         expires_at, workspace_id)
       VALUES ($1, $2, $3, $4,
               CURRENT_TIMESTAMP + ($5 || ' minutes')::interval,
               $6)
       RETURNING *`,
      [
        input.outletId,
        input.clientId ?? null,
        input.clientName ?? null,
        input.clientPhone ?? null,
        String(ttl),
        input.workspaceId,
      ]
    );
    return mapRow(r.rows[0]);
  }

  /** Liste les scans actifs (non expirés, non consommés) pour un outlet. */
  async listActive(outletId: string): Promise<PendingClientScan[]> {
    const r = await db.query(
      `SELECT * FROM pending_client_scans
       WHERE outlet_id = $1
         AND consumed_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY scanned_at DESC`,
      [outletId]
    );
    return r.rows.map(mapRow);
  }

  /** Le scan le plus récent encore actif (pour pré-sélection automatique). */
  async getMostRecentActive(outletId: string): Promise<PendingClientScan | null> {
    const r = await db.query(
      `SELECT * FROM pending_client_scans
       WHERE outlet_id = $1
         AND consumed_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY scanned_at DESC LIMIT 1`,
      [outletId]
    );
    return r.rows.length > 0 ? mapRow(r.rows[0]) : null;
  }

  /** Marque un scan consommé en le rattachant à la vente créée. */
  async consume(scanId: string, saleId: string): Promise<PendingClientScan> {
    const r = await db.query(
      `UPDATE pending_client_scans
       SET consumed_at = CURRENT_TIMESTAMP,
           consumed_by_sale_id = $2
       WHERE id = $1 AND consumed_at IS NULL
       RETURNING *`,
      [scanId, saleId]
    );
    if (r.rows.length === 0) throw new Error('Scan introuvable ou déjà consommé');
    return mapRow(r.rows[0]);
  }

  /** Housekeeping : supprime les scans expirés non consommés. */
  async purgeExpired(): Promise<number> {
    const r = await db.query(
      `DELETE FROM pending_client_scans
       WHERE consumed_at IS NULL AND expires_at < CURRENT_TIMESTAMP`
    );
    return r.rowCount ?? 0;
  }
}

function mapRow(r: any): PendingClientScan {
  return {
    id: r.id,
    OutletId: r.outlet_id,
    ClientId: r.client_id ?? undefined,
    ClientName: r.client_name ?? undefined,
    ClientPhone: r.client_phone ?? undefined,
    ScannedAt: r.scanned_at?.toISOString?.() ?? r.scanned_at,
    ExpiresAt: r.expires_at?.toISOString?.() ?? r.expires_at,
    ConsumedAt: r.consumed_at ? (r.consumed_at.toISOString?.() ?? r.consumed_at) : undefined,
    ConsumedBySaleId: r.consumed_by_sale_id ?? undefined,
    WorkspaceId: r.workspace_id,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
  };
}
