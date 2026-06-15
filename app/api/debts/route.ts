/**
 * API Route - Dettes & créances (cockpit unifié)
 *
 * GET /api/debts            → synthèse (à payer / à recevoir)
 * GET /api/debts?kind=...   → détail par tiers d'un poste
 *
 * Une dette = solde d'un compte de tiers (classe 4). On lit les états
 * opérationnels qui alimentent ces comptes :
 *   À PAYER   : fournisseurs (dépenses approuvées non payées → 401),
 *               salaires (reste à verser → 421), charges sociales
 *               (CNPS/DGI/FDFP dues − réglées → 431/442/447)
 *   À RECEVOIR: clients (ventes à crédit → 411), avances au personnel
 *               (encours → 425)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { ensurePayrollTable } from '@/lib/modules/hr/payroll-service';
import { handleApiError } from '@/lib/http/api-error';

const db = getPostgresClient();

async function num(sql: string, params: any[], key = 'total'): Promise<number> {
  try { return Math.round(Number((await db.query(sql, params)).rows[0]?.[key]) || 0); }
  catch { return 0; }
}

/** Charges sociales/fiscales dues − réglées (toutes périodes payées). */
async function chargesRemaining(ws: string): Promise<number> {
  try {
    const due = (await db.query(
      `SELECT COALESCE(SUM(COALESCE(cnps_employee,0)),0)::float AS cnps_sal,
              COALESCE(SUM(COALESCE(employer_total,0)),0)::float AS employer_total,
              COALESCE(SUM(COALESCE(its_amount,0)),0)::float AS its
       FROM payrolls WHERE workspace_id=$1 AND (status='paid' OR COALESCE(amount_paid,0)>0)`,
      [ws])).rows[0];
    const totalDue = (Number(due.cnps_sal) || 0) + (Number(due.employer_total) || 0) + (Number(due.its) || 0);
    const paid = await num(
      `SELECT COALESCE(SUM(amount),0) AS total FROM charge_settlements WHERE workspace_id=$1`, [ws]);
    return Math.max(0, Math.round(totalDue) - paid);
  } catch { return 0; }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);
    const ws = await getCurrentWorkspaceId();
    await ensurePayrollTable();
    const kind = request.nextUrl.searchParams.get('kind');

    if (kind) return NextResponse.json({ data: await drill(ws, kind) });

    const [suppliers, salaries, clients, staffAdvances] = await Promise.all([
      num(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses
           WHERE workspace_id=$1 AND status IN ('approved','scheduled')`, [ws]),
      num(`SELECT COALESCE(SUM(net_salary - COALESCE(amount_paid,0)),0) AS total FROM payrolls
           WHERE workspace_id=$1 AND status IN ('validated','paid')
             AND net_salary - COALESCE(amount_paid,0) > 0`, [ws]),
      num(`SELECT COALESCE(SUM(balance),0) AS total FROM sales
           WHERE workspace_id=$1 AND status!='cancelled' AND balance>0`, [ws]),
      num(`SELECT COALESCE(SUM(amount-recovered),0) AS total FROM employee_advances_simple
           WHERE workspace_id=$1 AND status='open'`, [ws]),
    ]);
    const socialCharges = await chargesRemaining(ws);
    const toPay = suppliers + salaries + socialCharges;
    const toReceive = clients + staffAdvances;

    return NextResponse.json({
      data: {
        toPay: { suppliers, salaries, socialCharges, total: toPay },
        toReceive: { clients, staffAdvances, total: toReceive },
        netPosition: toReceive - toPay,
      },
    });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement des dettes');
  }
}

async function drill(ws: string, kind: string): Promise<{ title: string; rows: any[]; settleHref?: string }> {
  switch (kind) {
    case 'suppliers': {
      const r = (await db.query(
        `SELECT e.title AS label, e.amount::float AS value, e.status,
                COALESCE(a.name, '—') AS supplier
         FROM expenses e
         LEFT JOIN purchase_request_lines prl ON prl.expense_request_id = e.expense_request_id
         LEFT JOIN accounts a ON a.id = prl.supplier_account_id
         WHERE e.workspace_id=$1 AND e.status IN ('approved','scheduled')
         GROUP BY e.id, e.title, e.amount, e.status, a.name
         ORDER BY e.amount DESC LIMIT 50`, [ws])).rows;
      return {
        title: 'Fournisseurs — à payer', settleHref: '/expenses/requests?status=approved',
        rows: r.map((x: any) => ({ label: x.label, value: Math.round(Number(x.value)),
          sub: `${x.supplier !== '—' ? x.supplier + ' · ' : ''}${x.status === 'scheduled' ? 'planifiée' : 'approuvée'}` })),
      };
    }
    case 'salaries': {
      const r = (await db.query(
        `SELECT e.full_name AS label, p.period,
                (p.net_salary - COALESCE(p.amount_paid,0))::float AS value
         FROM payrolls p JOIN employees e ON e.id = p.employee_id
         WHERE p.workspace_id=$1 AND p.status IN ('validated','paid')
           AND p.net_salary - COALESCE(p.amount_paid,0) > 0
         ORDER BY value DESC LIMIT 50`, [ws])).rows;
      return {
        title: 'Salaires — reste à verser', settleHref: '/hr/payroll',
        rows: r.map((x: any) => ({ label: x.label, value: Math.round(Number(x.value)), sub: x.period })),
      };
    }
    case 'socialCharges': {
      const due = (await db.query(
        `SELECT period,
                SUM(COALESCE(cnps_employee,0))::float AS cnps_sal,
                SUM(COALESCE(employer_total,0))::float AS employer_total,
                SUM(COALESCE((employer_charges->>'fdfpApprenticeship')::numeric,0)
                  + COALESCE((employer_charges->>'fdfpContinuingTraining')::numeric,0))::float AS fdfp,
                SUM(COALESCE(its_amount,0))::float AS its
         FROM payrolls WHERE workspace_id=$1 AND (status='paid' OR COALESCE(amount_paid,0)>0)
         GROUP BY period`, [ws])).rows;
      const paid = (await db.query(
        `SELECT period, SUM(amount)::float AS p FROM charge_settlements WHERE workspace_id=$1 GROUP BY period`,
        [ws])).rows;
      const paidByPeriod = new Map(paid.map((x: any) => [x.period, Math.round(Number(x.p))]));
      const rows = due.map((x: any) => {
        const fdfp = Math.round(Number(x.fdfp) || 0);
        const total = Math.round((Number(x.cnps_sal) || 0) + (Number(x.employer_total) || 0) + (Number(x.its) || 0));
        const remaining = Math.max(0, total - (paidByPeriod.get(x.period) ?? 0));
        return { label: x.period, value: remaining, sub: remaining > 0 ? 'CNPS · DGI · FDFP' : 'soldé' };
      }).filter((x: any) => x.value > 0).sort((a: any, b: any) => b.value - a.value);
      return { title: 'Charges sociales — à régler', settleHref: '/hr/payroll/charges', rows };
    }
    case 'clients': {
      const r = (await db.query(
        `SELECT COALESCE(c.name, o.name, 'Comptoir') AS label,
                SUM(s.balance)::float AS value, COUNT(*)::int AS n
         FROM sales s
         LEFT JOIN clients c ON c.id = s.client_id
         LEFT JOIN outlets o ON o.id = s.outlet_id
         WHERE s.workspace_id=$1 AND s.status!='cancelled' AND s.balance>0
         GROUP BY COALESCE(c.name, o.name, 'Comptoir') ORDER BY value DESC LIMIT 50`, [ws])).rows;
      return {
        title: 'Clients — à recouvrer',
        rows: r.map((x: any) => ({ label: x.label, value: Math.round(Number(x.value)), sub: `${x.n} vente(s) à crédit` })),
      };
    }
    case 'staffAdvances': {
      const r = (await db.query(
        `SELECT e.full_name AS label, SUM(a.amount - a.recovered)::float AS value, COUNT(*)::int AS n
         FROM employee_advances_simple a JOIN employees e ON e.id = a.employee_id
         WHERE a.workspace_id=$1 AND a.status='open'
         GROUP BY e.full_name ORDER BY value DESC LIMIT 50`, [ws])).rows;
      return {
        title: 'Avances au personnel — encours', settleHref: '/hr/advances',
        rows: r.map((x: any) => ({ label: x.label, value: Math.round(Number(x.value)), sub: `${x.n} avance(s)` })),
      };
    }
    default:
      return { title: 'Inconnu', rows: [] };
  }
}
