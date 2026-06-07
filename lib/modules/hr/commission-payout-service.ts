/**
 * Service - Primes des commerciaux versées à la clôture de caisse
 *
 * Réalité terrain : à la fin de la journée, après la clôture de caisse,
 * chaque commercial effectivement présent sur le stand reçoit EN ESPÈCES :
 *   - sa prime de transport (transport_daily de sa fiche employé, 2 500 F
 *     par défaut) ;
 *   - sa prime de vente : forfait par unité vendue, défini par produit
 *     (products.sales_bonus_per_unit) avec repli sur le forfait global du
 *     workspace (workspaces.sales_bonus_per_unit).
 *
 * Cohérence garantie :
 *   - transaction de trésorerie (sortie de la caisse DU stand) ;
 *   - écriture comptable CAI (D 6614/661 ÷ C 571) en best-effort ;
 *   - trace dans commission_payouts (unique par vendeur/stand/jour/type)
 *     → reprise sur le bulletin de paie mensuel comme acompte déjà versé ;
 *   - le cash attendu du Z-out tient compte de ces sorties.
 */

import { getPostgresClient } from '@/lib/database/postgres-client';
import { v4 as uuidv4 } from 'uuid';
import { ensurePayrollTable } from './payroll-service';
import { JournalGenerationService } from '@/lib/modules/accounting/journal-generation-service';

const db = getPostgresClient();
const journalGen = new JournalGenerationService();

// Colonnes de configuration des primes de vente (bases sans migrations)
let bonusColumnsEnsured: Promise<void> | null = null;
function ensureBonusColumns(): Promise<void> {
  if (!bonusColumnsEnsured) {
    bonusColumnsEnsured = (async () => {
      await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_bonus_per_unit DECIMAL(15, 2)`);
      // Forfait métier confirmé : 100 F par produit vendu (modifiable
      // à tout moment via /hr/payroll/settings)
      await db.query(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS sales_bonus_per_unit DECIMAL(15, 2) DEFAULT 100`);
      await db.query(`UPDATE workspaces SET sales_bonus_per_unit = 100 WHERE sales_bonus_per_unit IS NULL`);
    })().catch(e => { bonusColumnsEnsured = null; throw e; });
  }
  return bonusColumnsEnsured;
}

export interface SessionPayoutResult {
  paid: Array<{ kind: 'transport' | 'sales_bonus'; amount: number; units?: number }>;
  total: number;
  skipped?: string; // raison si rien n'a été versé
}

export class CommissionPayoutService {
  /**
   * Verse les primes du jour au vendeur d'une session POS, depuis la
   * caisse du stand. Idempotent (une prime de chaque type par vendeur,
   * stand et jour). À appeler à la clôture de caisse, AVANT le calcul
   * du cash attendu.
   */
  async payForSession(sessionId: string, paidByUserUuid: string): Promise<SessionPayoutResult> {
    await ensurePayrollTable();
    await ensureBonusColumns();

    const sR = await db.query<any>(
      `SELECT ps.id, ps.outlet_id, ps.user_id, ps.workspace_id, ps.started_at,
              o.name AS outlet_name
       FROM pos_sessions ps
       JOIN outlets o ON o.id = ps.outlet_id
       WHERE ps.id = $1 LIMIT 1`,
      [sessionId]
    );
    if (!sR.rows[0]) throw new Error('Session introuvable');
    const session = sR.rows[0];
    const payoutDate = new Date(session.started_at).toISOString().slice(0, 10);

    // Le vendeur doit avoir une fiche employé (transport_daily configurable)
    const eR = await db.query<any>(
      `SELECT id, full_name, transport_daily::float AS transport_daily
       FROM employees
       WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
      [session.workspace_id, session.user_id]
    );
    if (!eR.rows[0]) return { paid: [], total: 0, skipped: 'Pas de fiche employé pour ce vendeur' };
    const employee = eR.rows[0];

    // Primes déjà versées aujourd'hui (idempotence)
    const doneR = await db.query<any>(
      `SELECT kind FROM commission_payouts
       WHERE seller_user_id = $1 AND outlet_id = $2 AND payout_date = $3`,
      [session.user_id, session.outlet_id, payoutDate]
    );
    const done = new Set(doneR.rows.map((r: any) => r.kind));

    // Prime de vente du jour : unités vendues par CE vendeur sur CE stand
    const bonusR = await db.query<any>(
      `SELECT COALESCE(SUM(si.quantity * COALESCE(p.sales_bonus_per_unit, w.sales_bonus_per_unit, 0)), 0)::float AS bonus,
              COALESCE(SUM(si.quantity), 0)::int AS units
       FROM sale_items si
       JOIN sales sa ON sa.id = si.sale_id
       JOIN workspaces w ON w.id = sa.workspace_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE sa.workspace_id = $1 AND sa.outlet_id = $2 AND sa.sales_person_id = $3
         AND sa.sale_date::date = $4::date AND sa.status != 'cancelled'`,
      [session.workspace_id, session.outlet_id, session.user_id, payoutDate]
    );
    const salesBonus = Math.round(bonusR.rows[0].bonus);
    const unitsSold = bonusR.rows[0].units;

    const toPay: Array<{ kind: 'transport' | 'sales_bonus'; amount: number; units?: number }> = [];
    if (!done.has('transport') && (employee.transport_daily || 0) > 0) {
      toPay.push({ kind: 'transport', amount: Math.round(employee.transport_daily) });
    }
    if (!done.has('sales_bonus') && salesBonus > 0) {
      toPay.push({ kind: 'sales_bonus', amount: salesBonus, units: unitsSold });
    }
    if (toPay.length === 0) return { paid: [], total: 0, skipped: done.size > 0 ? 'Primes du jour déjà versées' : 'Aucune prime à verser' };

    const total = toPay.reduce((s, p) => s + p.amount, 0);

    // Caisse du stand — verrouillée ; on ne met pas le tiroir à découvert
    const result = await db.transaction(async (client) => {
      const wR = await client.query(
        `SELECT id, balance::float AS balance, chart_account_id
         FROM wallets
         WHERE outlet_id = $1 AND type = 'cash' AND is_active = true
         LIMIT 1 FOR UPDATE`,
        [session.outlet_id]
      );
      if (!wR.rows[0]) {
        return { paid: [], total: 0, skipped: 'Pas de caisse espèces pour ce stand' } as SessionPayoutResult;
      }
      const wallet = wR.rows[0];
      if (wallet.balance < total) {
        return { paid: [], total: 0, skipped: `Caisse insuffisante (${wallet.balance} F) pour verser ${total} F de primes` } as SessionPayoutResult;
      }

      const labels: Record<string, string> = {
        transport: `Prime de transport — ${employee.full_name} — ${payoutDate}`,
        sales_bonus: `Prime de vente (${unitsSold} unités) — ${employee.full_name} — ${payoutDate}`,
      };

      for (const p of toPay) {
        const txUuid = uuidv4();
        await client.query(
          `INSERT INTO transactions (transaction_id, transaction_number, type, category, amount,
                                     source_wallet_id, destination_wallet_id, description, reference,
                                     status, processed_by_id, processed_at, workspace_id)
           VALUES ($1, $2, 'expense', 'salary', $3, $4, NULL, $5, $6, 'completed', $7, CURRENT_TIMESTAMP, $8)`,
          [txUuid, `PRM-${payoutDate.replace(/-/g, '')}-${uuidv4().slice(0, 12)}`,
           p.amount, wallet.id, labels[p.kind], `PRM-${p.kind}-${payoutDate}`,
           paidByUserUuid, session.workspace_id]
        );
        await client.query(
          `INSERT INTO commission_payouts (payout_date, outlet_id, seller_user_id, kind, units, amount,
                                           wallet_id, transaction_id, pos_session_id, workspace_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (seller_user_id, outlet_id, payout_date, kind) DO NOTHING`,
          [payoutDate, session.outlet_id, session.user_id, p.kind, p.units ?? 0, p.amount,
           wallet.id, txUuid, session.id, session.workspace_id]
        );
      }
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [total, wallet.id]
      );
      return { paid: toPay, total, walletAccountId: wallet.chart_account_id } as SessionPayoutResult & { walletAccountId?: string };
    });

    // Écritures comptables CAI — best-effort (la trésorerie fait foi)
    if (result.paid.length > 0) {
      const walletAccountId = (result as any).walletAccountId ?? null;
      for (const p of result.paid) {
        try {
          await journalGen.fromCashPayout({
            workspaceId: session.workspace_id,
            date: new Date(payoutDate),
            reference: `PRM-${p.kind}-${payoutDate}-${session.outlet_id.slice(0, 8)}`,
            description: p.kind === 'transport'
              ? `Prime de transport ${employee.full_name} — ${session.outlet_name}`
              : `Prime de vente ${employee.full_name} (${p.units} u.) — ${session.outlet_name}`,
            amount: p.amount,
            cashAccountId: walletAccountId,
            chargeAccountPrefixes: p.kind === 'transport' ? ['6614', '661', '66'] : ['661', '66'],
          });
        } catch (e: any) {
          console.warn('[commission-payout] écriture CAI sautée:', e.message);
        }
      }
    }

    delete (result as any).walletAccountId;
    return result;
  }

  /** Primes versées sur un stand à une date (pour le journal de caisse). */
  async listForOutletDate(outletId: string, date: string): Promise<any[]> {
    await ensurePayrollTable();
    const r = await db.query<any>(
      `SELECT cp.kind AS "Kind", cp.units AS "Units", cp.amount::float AS "Amount",
              cp.payout_date AS "PayoutDate", u.full_name AS "SellerName"
       FROM commission_payouts cp
       JOIN users u ON u.id = cp.seller_user_id
       WHERE cp.outlet_id = $1 AND cp.payout_date = $2::date
       ORDER BY u.full_name, cp.kind`,
      [outletId, date]
    );
    return r.rows;
  }
}
