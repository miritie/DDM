/**
 * Service - Versements de caisse (cash_deposits)
 *
 * Le vendeur dépose tout ou partie de la caisse espèces du stand :
 *   - vers la banque (sélection d'un wallet bank du workspace)
 *   - vers un mobile money (sélection d'un wallet mobile_money)
 *   - en espèces remises à un responsable (texte libre)
 *
 * À la création : décrément ATOMIQUE du wallet source dans la même
 * transaction que l'INSERT (un dépôt n'apparaît jamais sans avoir
 * réellement débité la caisse).
 *
 * Workflow pending → validated / rejected :
 *   - pending   : créé par le vendeur, wallet source décrémenté
 *   - validated : confirmé par le comptable, RAS (déjà débité)
 *   - rejected  : annulé par le comptable, wallet source RE-CRÉDITÉ
 *
 * Si rejected sur un dépôt vers wallet (bank / MM) après validation
 * éventuelle qui aurait crédité la destination, le service annule
 * également ce crédit. Pour V1 : on ne crédite PAS automatiquement
 * la destination — c'est au comptable de rapprocher.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';
import { assertPositiveFinishedProductQuantity } from '@/lib/schemas/quantity';

const db = getPostgresClient();

export type CashDepositDestinationType = 'bank' | 'person' | 'mobile_money';
export type CashDepositStatus = 'pending' | 'validated' | 'rejected';

export interface CreateCashDepositInput {
  outletId: string;
  walletSourceId: string;            // wallet caisse stand (cash)
  destinationType: CashDepositDestinationType;
  destinationWalletId?: string;      // requis pour bank / mobile_money
  destinationLabel?: string;         // requis pour person, optionnel pour autres
  amount: number;
  currency?: string;
  reference?: string;
  evidenceUrl?: string;
  notes?: string;
  depositedById: string;             // UUID PK user
  workspaceId: string;
}

export interface CashDepositRow {
  id: string;
  DepositId: string;
  OutletId: string;
  OutletName?: string;
  WalletSourceId: string;
  WalletSourceName?: string;
  DestinationType: CashDepositDestinationType;
  DestinationWalletId: string | null;
  DestinationWalletName?: string | null;
  DestinationLabel: string | null;
  Amount: number;
  Currency: string;
  Reference: string | null;
  EvidenceUrl: string | null;
  Notes: string | null;
  Status: CashDepositStatus;
  DepositedById: string;
  DepositedByName?: string;
  DepositedAt: string;
  ValidatedById: string | null;
  ValidatedByName?: string | null;
  ValidatedAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export class CashDepositService {

  async create(input: CreateCashDepositInput): Promise<CashDepositRow> {
    if (input.amount <= 0) throw new Error('Le montant doit être strictement positif');
    // Réutilise le helper Zod : montant entier > 0.
    assertPositiveFinishedProductQuantity(Math.round(input.amount), 'Montant déposé');

    // Validation cohérence destination
    if (input.destinationType === 'person') {
      if (!input.destinationLabel?.trim()) {
        throw new Error('Un nom de bénéficiaire est requis pour une remise en espèces');
      }
      if (input.destinationWalletId) {
        throw new Error('Pas de wallet destination pour une remise en espèces');
      }
    } else {
      if (!input.destinationWalletId) {
        throw new Error('Sélectionnez un wallet destination (banque ou mobile money)');
      }
    }

    const depositId = 'DEP-' + Date.now().toString().slice(-10);

    return await db.transaction(async (client) => {
      // 1) Vérifier le solde du wallet source
      const walletRes = await client.query<any>(
        `SELECT id, balance, type FROM wallets WHERE id = $1 FOR UPDATE`,
        [input.walletSourceId]
      );
      if (walletRes.rows.length === 0) throw new Error('Wallet caisse introuvable');
      const wallet = walletRes.rows[0];
      const currentBalance = Number(wallet.balance);
      if (currentBalance < input.amount) {
        throw new Error(`Solde caisse insuffisant : ${currentBalance} ${input.currency || 'XOF'} disponible, ${input.amount} demandé`);
      }

      // 2) Décrémenter le wallet (atomique grâce à la transaction + FOR UPDATE)
      await client.query(
        `UPDATE wallets SET balance = balance - $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [input.walletSourceId, input.amount]
      );

      // 3) Insérer le dépôt en pending
      const ins = await client.query<any>(
        `INSERT INTO cash_deposits
          (deposit_id, outlet_id, wallet_source_id,
           destination_type, destination_wallet_id, destination_label,
           amount, currency, reference, evidence_url, notes,
           status, deposited_by_id, workspace_id)
         VALUES ($1, $2::uuid, $3::uuid,
                 $4::cash_deposit_destination_type, $5::uuid, $6::varchar,
                 $7, $8, $9::varchar, $10::text, $11::text,
                 'pending', $12::uuid, $13::uuid)
         RETURNING *`,
        [
          depositId,
          input.outletId,
          input.walletSourceId,
          input.destinationType,
          input.destinationWalletId ?? null,
          input.destinationLabel ?? null,
          input.amount,
          input.currency || 'XOF',
          input.reference ?? null,
          input.evidenceUrl ?? null,
          input.notes ?? null,
          input.depositedById,
          input.workspaceId,
        ]
      );

      return mapRow(ins.rows[0]);
    });
  }

  async list(
    workspaceId: string,
    filters: { outletId?: string; status?: CashDepositStatus; limit?: number } = {}
  ): Promise<CashDepositRow[]> {
    const params: any[] = [workspaceId];
    let where = 'cd.workspace_id = $1';
    if (filters.outletId) {
      params.push(filters.outletId);
      where += ` AND cd.outlet_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      where += ` AND cd.status = $${params.length}::cash_deposit_status`;
    }
    const limit = Math.max(1, Math.min(500, filters.limit ?? 100));
    params.push(limit);

    const r = await db.query<any>(
      `SELECT cd.*,
              o.name AS outlet_name,
              ws.name AS wallet_source_name,
              wd.name AS destination_wallet_name,
              u1.full_name AS deposited_by_name,
              u2.full_name AS validated_by_name
       FROM cash_deposits cd
       LEFT JOIN outlets o ON o.id = cd.outlet_id
       LEFT JOIN wallets ws ON ws.id = cd.wallet_source_id
       LEFT JOIN wallets wd ON wd.id = cd.destination_wallet_id
       LEFT JOIN users u1 ON u1.id = cd.deposited_by_id
       LEFT JOIN users u2 ON u2.id = cd.validated_by_id
       WHERE ${where}
       ORDER BY cd.deposited_at DESC
       LIMIT $${params.length}`,
      params
    );
    return r.rows.map(mapRow);
  }

  async getById(id: string): Promise<CashDepositRow | null> {
    const r = await db.query<any>(
      `SELECT cd.*,
              o.name AS outlet_name,
              ws.name AS wallet_source_name,
              wd.name AS destination_wallet_name,
              u1.full_name AS deposited_by_name,
              u2.full_name AS validated_by_name
       FROM cash_deposits cd
       LEFT JOIN outlets o ON o.id = cd.outlet_id
       LEFT JOIN wallets ws ON ws.id = cd.wallet_source_id
       LEFT JOIN wallets wd ON wd.id = cd.destination_wallet_id
       LEFT JOIN users u1 ON u1.id = cd.deposited_by_id
       LEFT JOIN users u2 ON u2.id = cd.validated_by_id
       WHERE cd.id = $1 OR cd.deposit_id = $1
       LIMIT 1`,
      [id]
    );
    return r.rows.length > 0 ? mapRow(r.rows[0]) : null;
  }

  async validate(id: string, validatorUuid: string): Promise<CashDepositRow> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Dépôt introuvable');
    if (existing.Status !== 'pending') {
      throw new Error(`Ce dépôt n'est pas en attente (statut : ${existing.Status})`);
    }
    // CAS sur le statut : si un autre comptable a déjà tranché entre
    // notre lecture et l'UPDATE, on rejette l'opération.
    const r = await db.query(
      `UPDATE cash_deposits
         SET status = 'validated',
             validated_by_id = $2::uuid,
             validated_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'`,
      [existing.id, validatorUuid]
    );
    if (r.rowCount === 0) {
      throw new Error('Dépôt déjà traité par un autre utilisateur');
    }
    return (await this.getById(existing.id))!;
  }

  async reject(id: string, validatorUuid: string): Promise<CashDepositRow> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Dépôt introuvable');
    if (existing.Status !== 'pending') {
      throw new Error(`Ce dépôt n'est pas en attente (statut : ${existing.Status})`);
    }

    return await db.transaction(async (client) => {
      // CAS + re-crédit du wallet source dans la même transaction.
      const upd = await client.query(
        `UPDATE cash_deposits
           SET status = 'rejected',
               validated_by_id = $2::uuid,
               validated_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND status = 'pending'`,
        [existing.id, validatorUuid]
      );
      if (upd.rowCount === 0) {
        throw new Error('Dépôt déjà traité par un autre utilisateur');
      }
      // Re-crédite le wallet source — annulation propre du dépôt.
      await client.query(
        `UPDATE wallets SET balance = balance + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [existing.WalletSourceId, existing.Amount]
      );
      const refreshed = await this.getById(existing.id);
      return refreshed!;
    });
  }
}

function mapRow(r: any): CashDepositRow {
  return {
    id: r.id,
    DepositId: r.deposit_id,
    OutletId: r.outlet_id,
    OutletName: r.outlet_name ?? undefined,
    WalletSourceId: r.wallet_source_id,
    WalletSourceName: r.wallet_source_name ?? undefined,
    DestinationType: r.destination_type,
    DestinationWalletId: r.destination_wallet_id ?? null,
    DestinationWalletName: r.destination_wallet_name ?? null,
    DestinationLabel: r.destination_label ?? null,
    Amount: Number(r.amount),
    Currency: r.currency,
    Reference: r.reference ?? null,
    EvidenceUrl: r.evidence_url ?? null,
    Notes: r.notes ?? null,
    Status: r.status,
    DepositedById: r.deposited_by_id,
    DepositedByName: r.deposited_by_name ?? undefined,
    DepositedAt: r.deposited_at?.toISOString?.() ?? r.deposited_at,
    ValidatedById: r.validated_by_id ?? null,
    ValidatedByName: r.validated_by_name ?? null,
    ValidatedAt: r.validated_at?.toISOString?.() ?? null,
    CreatedAt: r.created_at?.toISOString?.() ?? r.created_at,
    UpdatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  };
}
