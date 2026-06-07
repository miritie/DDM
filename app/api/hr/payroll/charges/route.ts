/**
 * API Route - Dettes sociales & fiscales issues de la paie
 *
 * GET  /api/hr/payroll/charges
 *   Récapitulatif par période (bulletins PAYÉS, même partiellement) :
 *     - CNPS : retenue salariale 6,3 % + parts patronales + CMU → compte 431
 *     - DGI : ITS retenu à la source → compte 442x
 *     - FDFP : TAP 0,4 % + TFPC 1,2 % → compte 447x
 *   Pour chaque organisme : dû, déjà réglé (somme des versements,
 *   table charge_settlements), reste. Échéance légale : le 15 du mois
 *   suivant (e-CNPS / e-Impôts / e-FDFP).
 *
 * POST { period, organism: 'CNPS'|'DGI'|'FDFP', amount? }
 *   Versement (PARTIEL autorisé — défaut : tout le reste) depuis la
 *   banque : transaction + écriture D 431/442/447 ÷ C 521. La dette
 *   reste visible tant qu'elle n'est pas soldée.
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

const ORGANISMS: Record<string, { prefixes: string[]; label: (p: string) => string }> = {
  CNPS: { prefixes: ['431', '43'], label: p => `Règlement CNPS (retraite + PF + maternité + AT + CMU) — ${p}` },
  DGI: { prefixes: ['442', '44'], label: p => `Règlement DGI — ITS retenu à la source — ${p}` },
  FDFP: { prefixes: ['447', '44'], label: p => `Règlement FDFP (TAP + TFPC) — ${p}` },
};

/** Dû par période et organisme (bulletins payés, même partiellement). */
async function dueByPeriod(workspaceId: string, period?: string) {
  const params: any[] = [workspaceId];
  let where = `workspace_id = $1 AND (status = 'paid' OR COALESCE(amount_paid, 0) > 0)`;
  if (period) { params.push(period); where += ` AND period = $${params.length}`; }
  const r = await db.query(
    `SELECT period,
            COUNT(*)::int AS bulletins,
            SUM(cnps_employee)::float AS cnps_salarial,
            SUM(employer_total)::float AS employer_total,
            SUM(COALESCE((employer_charges->>'fdfpApprenticeship')::numeric, 0)
              + COALESCE((employer_charges->>'fdfpContinuingTraining')::numeric, 0))::float AS fdfp,
            SUM(its_amount)::float AS its
     FROM payrolls WHERE ${where}
     GROUP BY period ORDER BY period DESC LIMIT 36`,
    params
  );
  return r.rows.map((row: any) => {
    const fdfp = Math.round(Number(row.fdfp) || 0);
    const cnps = Math.round((Number(row.cnps_salarial) || 0) + ((Number(row.employer_total) || 0) - (Number(row.fdfp) || 0)));
    const its = Math.round(Number(row.its) || 0);
    return { period: row.period as string, bulletins: row.bulletins as number, due: { CNPS: cnps, DGI: its, FDFP: fdfp } };
  });
}

/** Versements déjà effectués par période et organisme. */
async function paidByPeriod(workspaceId: string) {
  const r = await db.query(
    `SELECT period, organism, SUM(amount)::float AS paid, MAX(paid_at) AS last_paid_at
     FROM charge_settlements WHERE workspace_id = $1
     GROUP BY period, organism`,
    [workspaceId]
  );
  const map = new Map<string, { paid: number; lastPaidAt: any }>();
  for (const row of r.rows) {
    map.set(`${row.period}:${row.organism}`, { paid: Math.round(Number(row.paid) || 0), lastPaidAt: row.last_paid_at });
  }
  return map;
}

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.HR_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    await ensurePayrollTable();

    const due = await dueByPeriod(workspaceId);
    const paid = await paidByPeriod(workspaceId);

    const data = due.map(row => {
      const [y, m] = row.period.split('-').map(Number);
      const dueDate = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 15)).toISOString().slice(0, 10);
      const organisms = (['CNPS', 'DGI', 'FDFP'] as const).map(org => {
        const dueAmt = row.due[org];
        const p = paid.get(`${row.period}:${org}`);
        const paidAmt = p?.paid ?? 0;
        return {
          organism: org,
          due: dueAmt,
          paid: Math.min(paidAmt, dueAmt),
          remaining: Math.max(0, dueAmt - paidAmt),
          lastPaidAt: p?.lastPaidAt ?? null,
        };
      }).filter(o => o.due > 0);
      const totalDue = organisms.reduce((s, o) => s + o.due, 0);
      const totalRemaining = organisms.reduce((s, o) => s + o.remaining, 0);
      return {
        period: row.period,
        bulletins: row.bulletins,
        organisms,
        total: totalDue,
        totalPaid: totalDue - totalRemaining,
        totalRemaining,
        dueDate,
        settled: totalRemaining <= 0,
      };
    });

    return NextResponse.json({ data });
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

    const body = await request.json().catch(() => ({}));
    const { period, organism } = body as { period?: string; organism?: string };
    if (!/^\d{4}-\d{2}$/.test(period || '')) {
      throw new ValidationError('Période invalide (format AAAA-MM)');
    }
    const orgDef = ORGANISMS[organism || ''];
    if (!orgDef) throw new ValidationError("organism attendu : 'CNPS' | 'DGI' | 'FDFP'");

    const [dueRow] = await dueByPeriod(workspaceId, period);
    if (!dueRow) throw new ConflictError('Aucun bulletin payé sur cette période');
    const due = dueRow.due[organism as 'CNPS' | 'DGI' | 'FDFP'];
    const alreadyPaid = (await paidByPeriod(workspaceId)).get(`${period}:${organism}`)?.paid ?? 0;
    const remaining = Math.max(0, due - alreadyPaid);
    if (remaining <= 0) throw new ConflictError(`${organism} ${period} : déjà soldé`);

    const amount = Math.min(
      body.amount && Number(body.amount) > 0 ? Math.round(Number(body.amount)) : remaining,
      remaining
    );

    // Banque verrouillée — versement partiel autorisé, jamais à découvert
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
      if (wallet.balance < amount) {
        throw new ConflictError(`Solde banque insuffisant (${Math.round(wallet.balance)} F) pour verser ${amount} F`);
      }
      const txUuid = uuidv4();
      await client.query(
        `INSERT INTO transactions (transaction_id, transaction_number, type, category, amount,
                                   source_wallet_id, description, reference, status,
                                   processed_by_id, processed_at, workspace_id)
         VALUES ($1, $2, 'expense', 'other', $3, $4, $5, $6, 'completed', $7, CURRENT_TIMESTAMP, $8)`,
        [txUuid, `CHG-${period!.replace('-', '')}-${organism}-${uuidv4().slice(0, 8)}`,
         amount, wallet.id,
         orgDef.label(period!) + (amount < remaining ? ` (versement partiel, reste ${remaining - amount} F)` : ''),
         `CHG-${organism}-${period}`, userUuid, workspaceId]
      );
      await client.query(
        `INSERT INTO charge_settlements (workspace_id, period, organism, amount, transaction_id, paid_by_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, period, organism, amount, txUuid, userUuid]
      );
      await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`, [amount, wallet.id]);
      return wallet.chart_account_id as string | null;
    });

    // Tout soldé sur la période → marquer les bulletins
    const [after] = await dueByPeriod(workspaceId, period);
    const paidNow = await paidByPeriod(workspaceId);
    const allSettled = (['CNPS', 'DGI', 'FDFP'] as const).every(org =>
      (paidNow.get(`${period}:${org}`)?.paid ?? 0) >= after.due[org]);
    if (allSettled) {
      await db.query(
        `UPDATE payrolls SET charges_settled_at = CURRENT_TIMESTAMP
         WHERE workspace_id = $1 AND period = $2 AND charges_settled_at IS NULL`,
        [workspaceId, period]
      );
    }

    // Écriture D 43x/44x ÷ C 521 — best-effort
    try {
      await journalGen.fromLiabilitySettlement({
        workspaceId,
        date: new Date(),
        reference: `CHG-${organism}-${period}-${uuidv4().slice(0, 8)}`,
        description: orgDef.label(period!),
        amount,
        debitAccountPrefixes: orgDef.prefixes,
        treasuryAccountId: bankAccountId,
      });
    } catch (e: any) {
      console.warn('[charges] écriture sautée:', e.message);
    }

    return NextResponse.json({
      success: true,
      data: { period, organism, amount, remaining: remaining - amount, settled: allSettled },
    });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du règlement des charges');
  }
}
