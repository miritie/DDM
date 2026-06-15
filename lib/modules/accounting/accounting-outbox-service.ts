/**
 * Service - Outbox comptable (génération différée et FIABLE des écritures)
 *
 * Problème résolu : certaines opérations métier (vente au stand, paiement
 * de dépense, paie) doivent réussir MÊME si l'écriture comptable ne peut
 * pas être produite immédiatement (plan comptable non initialisé, erreur
 * transitoire). Avant, l'échec était simplement loggé → l'opération
 * n'entrait JAMAIS dans les livres, sans trace ni rattrapage.
 *
 * Principe « transactional outbox » :
 *   1. AU moment de l'opération, dans LA MÊME transaction SQL, on inscrit
 *      une ligne « écriture à produire » (accounting_outbox, statut pending).
 *      → si l'opération est validée, l'intention comptable est DURABLE.
 *   2. Juste après le commit, on tente de produire l'écriture (process()).
 *      Succès → statut done. Échec → statut pending + erreur conservée.
 *   3. Une régularisation (bouton comptable / cron) rejoue tous les pending.
 *      Les générateurs sont IDEMPOTENTS (par référence) → rejouer est sûr.
 *
 * Résultat : la vente n'est jamais bloquée par la compta, mais aucune
 * écriture n'est jamais perdue. Les livres deviennent cohérents, et on
 * sait toujours combien d'écritures restent à régulariser.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { JournalGenerationService } from './journal-generation-service';

const db = getPostgresClient();
const journalGen = new JournalGenerationService();

export type OutboxSourceType =
  | 'sale' | 'sale_payment'
  | 'expense_engagement' | 'expense_payment'
  | 'payroll_payment';

interface Queryable { query: (sql: string, params?: any[]) => Promise<any>; }

let ensured: Promise<void> | null = null;
export function ensureOutboxTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS accounting_outbox (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_type VARCHAR(30) NOT NULL,
        source_id   UUID NOT NULL,
        reference   VARCHAR(80),
        status      VARCHAR(12) NOT NULL DEFAULT 'pending',
        attempts    INT NOT NULL DEFAULT 0,
        last_error  TEXT,
        entry_id    UUID,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        UNIQUE (source_type, source_id)
      )`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_outbox_pending
        ON accounting_outbox (workspace_id, status) WHERE status = 'pending'`);
    })().catch(e => { ensured = null; throw e; });
  }
  return ensured;
}

export class AccountingOutboxService {
  /**
   * Inscrit une intention d'écriture DANS la transaction SQL en cours
   * (client fourni). Idempotent : ON CONFLICT ne réinsère pas. La table
   * doit exister — appeler ensureOutboxTable() au démarrage de la route.
   */
  async enqueueInClient(client: Queryable, opts: {
    workspaceId: string; sourceType: OutboxSourceType; sourceId: string; reference?: string | null;
  }): Promise<void> {
    await client.query(
      `INSERT INTO accounting_outbox (workspace_id, source_type, source_id, reference)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (source_type, source_id) DO NOTHING`,
      [opts.workspaceId, opts.sourceType, opts.sourceId, opts.reference ?? null]
    );
  }

  /**
   * Inscrit une intention d'écriture HORS transaction (insert simple).
   * Pour les hooks qui ne sont pas dans une transaction SQL ouverte
   * (approbation de dépense…). Idempotent (ON CONFLICT).
   */
  async enqueue(opts: {
    workspaceId: string; sourceType: OutboxSourceType; sourceId: string; reference?: string | null;
  }): Promise<void> {
    await ensureOutboxTable();
    await this.enqueueInClient(db, opts);
  }

  /** Produit l'écriture d'une ligne d'outbox selon son type (idempotent). */
  private async generate(sourceType: OutboxSourceType, sourceId: string): Promise<string> {
    switch (sourceType) {
      case 'sale': return journalGen.fromSale(sourceId);
      case 'sale_payment': return journalGen.fromSalePayment(sourceId);
      case 'expense_engagement': return journalGen.fromExpenseEngagement(sourceId);
      case 'expense_payment': return journalGen.fromExpensePayment(sourceId);
      case 'payroll_payment': return journalGen.fromPayrollPayment(sourceId);
      default: throw new Error(`Type d'outbox inconnu : ${sourceType}`);
    }
  }

  /**
   * Tente de produire les écritures en attente. Best-effort par ligne :
   * une ligne qui échoue n'empêche pas les autres. Retourne le bilan.
   * @param workspaceId  limite au workspace (optionnel)
   * @param sourceIds    limite à des sources précises (traitement immédiat
   *                     après une vente : on ne rejoue pas toute la file)
   */
  async process(opts: { workspaceId?: string; sourceIds?: string[]; limit?: number } = {}):
    Promise<{ done: number; failed: number; remaining: number }> {
    await ensureOutboxTable();

    const params: any[] = [];
    let where = `status = 'pending'`;
    if (opts.workspaceId) { params.push(opts.workspaceId); where += ` AND workspace_id = $${params.length}`; }
    if (opts.sourceIds && opts.sourceIds.length) { params.push(opts.sourceIds); where += ` AND source_id = ANY($${params.length})`; }
    const limit = Math.min(opts.limit ?? 200, 500);

    const rows = (await db.query(
      `SELECT id, source_type, source_id FROM accounting_outbox
       WHERE ${where} ORDER BY created_at ASC LIMIT ${limit}`,
      params
    )).rows;

    let done = 0, failed = 0;
    for (const row of rows) {
      try {
        const entryId = await this.generate(row.source_type, row.source_id);
        await db.query(
          `UPDATE accounting_outbox
           SET status = 'done', entry_id = $2, processed_at = CURRENT_TIMESTAMP,
               attempts = attempts + 1, last_error = NULL
           WHERE id = $1`,
          [row.id, entryId]
        );
        done++;
      } catch (e: any) {
        await db.query(
          `UPDATE accounting_outbox
           SET attempts = attempts + 1, last_error = $2
           WHERE id = $1`,
          [row.id, String(e?.message ?? e).slice(0, 1000)]
        );
        failed++;
      }
    }

    const remaining = (await db.query(
      `SELECT COUNT(*)::int AS n FROM accounting_outbox WHERE ${where}`,
      params
    )).rows[0].n;

    return { done, failed, remaining };
  }

  /**
   * Engage comptablement une dépense approuvée (crée la dette fournisseur
   * 401) : inscrit l'intention puis tente de la produire. Best-effort —
   * à appeler après une approbation, ne doit jamais faire échouer celle-ci.
   */
  async engageExpense(workspaceId: string, expenseUuid: string, reference?: string | null): Promise<void> {
    try {
      await this.enqueue({ workspaceId, sourceType: 'expense_engagement', sourceId: expenseUuid, reference });
      await this.process({ workspaceId, sourceIds: [expenseUuid] });
    } catch (e: any) {
      console.warn(`[outbox] engagement dépense ${expenseUuid}: ${e?.message ?? e}`);
    }
  }

  /** Nombre d'écritures en attente (régularisation à faire). */
  async pendingCount(workspaceId: string): Promise<number> {
    await ensureOutboxTable();
    const r = await db.query(
      `SELECT COUNT(*)::int AS n FROM accounting_outbox
       WHERE workspace_id = $1 AND status = 'pending'`,
      [workspaceId]
    );
    return r.rows[0].n;
  }
}
