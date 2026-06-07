/**
 * API Route - Dettes sociales & fiscales issues de la paie
 *
 * GET  /api/hr/payroll/charges
 *   Récapitulatif par période (bulletins PAYÉS) :
 *     - CNPS : retenue salariale 6,3 % + parts patronales + CMU → compte 431
 *     - DGI : ITS retenu à la source → compte 442x
 *     - FDFP : TAP 0,4 % + TFPC 1,2 % → compte 447x
 *   Échéance légale : le 15 du mois suivant (e-CNPS / e-Impôts / e-FDFP).
 *
 * POST /api/hr/payroll/charges  { period: 'YYYY-MM' }
 *   Règle les trois organismes depuis la banque : transactions de
 *   trésorerie + écritures D 431/442/447 ÷ C 521, puis marque les
 *   bulletins de la période comme soldés.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId, getCurrentUserUuid } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { ensurePayrollTable } from '@/lib/modules/hr/payroll-service';
import { JournalGenerationService } from '@/lib/modules/accounting/journal-generation-service';
import { handleApiError, ValidationError, ConflictError } from '@/lib/http/api-error';
import { v4 as uuidv4 } from 'uuid';

const db = getPostgresClient();
const journalGen = new JournalGenerationService();

const AGGREGATE = `
  SELECT period,
         COUNT(*)::int AS bulletins,
         SUM(cnps_employee)::float AS cnps_salarial,
         SUM(employer_total)::float AS employer_total,
         SUM(COALESCE((employer_charges->>'fdfpApprenticeship')::numeric, 0)
           + COALESCE((employer_charges->>'fdfpContinuingTraining')::numeric, 0))::float AS fdfp,
         SUM(its_amount)::float AS its,
         BOOL_AND(charges_settled_at IS NOT NULL) AS settled,
         MAX(charges_settled_at) AS settled_at
  FROM payrolls
  WHERE workspace_id = $1 AND status = 'paid'`;

function shape(r: any) {
  const fdfp = Number(r.fdfp) || 0;
  const cnps = (Number(r.cnps_salarial) || 0) + ((Number(r.employer_total) || 0) - fdfp);
  const its = Number(r.its) || 0;
  const [y, m] = String(r.period).split('-').map(Number);
  const due = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 15));
  return {
    period: r.period,
    bulletins: r.bulletins,
    cnps: Math.round(cnps),
    its: Math.round(its),
    fdfp: Math.round(fdfp),
    total: Math.round(cnps + its + fdfp),
    dueDate: due.toISOString().slice(0, 10),
    settled: !!r.settled,
    settledAt: r.settled_at,
  };
}

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    await ensurePayrollTable();
    const r = await db.query(`${AGGREGATE} GROUP BY period ORDER BY period DESC LIMIT 36`, [workspaceId]);
    return NextResponse.json({ data: r.rows.map(shape) });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement des charges');
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.EXPENSE_PAY);
    const workspaceId = await getCurrentWorkspaceId();
    const userUuid = await getCurrentUserUuid();
    await ensurePayrollTable();

    const { period } = await request.json().catch(() => ({}));
    if (!/^\d{4}-\d{2}$/.test(period || '')) {
      throw new ValidationError('Période invalide (format AAAA-MM)');
    }

    const aggR = await db.query(
      `${AGGREGATE} AND period = $2 AND charges_settled_at IS NULL GROUP BY period`,
      [workspaceId, period]
    );
    if (!aggR.rows[0]) {
      throw new ConflictError('Rien à régler sur cette période (déjà soldée ou aucun bulletin payé)');
    }
    const agg = shape(aggR.rows[0]);

    const organisms = [
      { key: 'CNPS', amount: agg.cnps, prefixes: ['431', '43'], label: `Règlement CNPS (retraite + PF + maternité + AT + CMU) — ${period}` },
      { key: 'DGI', amount: agg.its, prefixes: ['442', '44'], label: `Règlement DGI — ITS retenu à la source — ${period}` },
      { key: 'FDFP', amount: agg.fdfp, prefixes: ['447', '44'], label: `Règlement FDFP (TAP + TFPC) — ${period}` },
    ].filter(o => o.amount > 0);

    const total = organisms.reduce((s, o) => s + o.amount, 0);
    const paid: any[] = [];

    // Banque verrouillée — un règlement par organisme, refus si découvert
    const bankAccountId = await db.transaction(async (client) => {
      const wR = await client.query(
        `SELECT id, balance::float AS balance, chart_account_id
         FROM wallets
         WHERE workspace_id = $1 AND type = 'bank' AND is_active = true
         ORDER BY name LIMIT 1 FOR UPDATE`,
        [workspaceId]
      );
      if (!wR.rows[0]) throw new ConflictError('Aucun compte bancaire actif pour régler les charges');
      const wallet = wR.rows[0];
      if (wallet.balance < total) {
        throw new ConflictError(`Solde banque insuffisant (${Math.round(wallet.balance)} F) pour régler ${total} F`);
      }
      for (const o of organisms) {
        await client.query(
          `INSERT INTO transactions (transaction_id, transaction_number, type, category, amount,
                                     source_wallet_id, description, reference, status,
                                     processed_by_id, processed_at, workspace_id)
           VALUES ($1, $2, 'expense', 'other', $3, $4, $5, $6, 'completed', $7, CURRENT_TIMESTAMP, $8)`,
          [uuidv4(), `CHG-${period.replace('-', '')}-${o.key}-${uuidv4().slice(0, 8)}`,
           o.amount, wallet.id, o.label, `CHG-${o.key}-${period}`, userUuid, workspaceId]
        );
        paid.push({ organism: o.key, amount: o.amount });
      }
      await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`, [total, wallet.id]);
      await client.query(
        `UPDATE payrolls SET charges_settled_at = CURRENT_TIMESTAMP
         WHERE workspace_id = $1 AND period = $2 AND status = 'paid' AND charges_settled_at IS NULL`,
        [workspaceId, period]
      );
      return wallet.chart_account_id as string | null;
    });

    // Écritures D 43x/44x ÷ C 521 — best-effort
    for (const o of organisms) {
      try {
        await journalGen.fromLiabilitySettlement({
          workspaceId,
          date: new Date(),
          reference: `CHG-${o.key}-${period}`,
          description: o.label,
          amount: o.amount,
          debitAccountPrefixes: o.prefixes,
          treasuryAccountId: bankAccountId,
        });
      } catch (e: any) {
        console.warn('[charges] écriture sautée:', e.message);
      }
    }

    return NextResponse.json({ success: true, data: { period, paid, total } });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du règlement des charges');
  }
}
