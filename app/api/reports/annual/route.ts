/**
 * API Route - Rapport annuel de pilotage (PCA)
 * GET /api/reports/annual?year=2025
 *
 * Bilan moral & financier d'une année effective, en agrégats SQL :
 *  - synthèse : CA, ventes, panier moyen, clients, dépenses, marge brute
 *  - tableau mensuel : production (qté + coût), MP reçues, CA, dépenses,
 *    salaires nets versés, marge
 *  - ventes par stand · performance des vendeurs (CA + primes terrain)
 *  - produits les plus rentables (CA, unités, marge estimée sur coût stock)
 *  - RH : effectif, embauches, masse salariale, nets versés, primes
 *  - charges patronales : dues vs réglées vs RESTE (CNPS / DGI / FDFP)
 *  - dettes fin de période : salaires restants + charges restantes
 *  - dépenses par catégorie · matières premières consommées
 *
 * Chaque bloc est isolé (try/catch) : un module absent ne casse pas le
 * rapport, il renvoie des zéros.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { handleApiError, ValidationError } from '@/lib/http/api-error';

const db = getPostgresClient();

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch (e: any) {
    console.warn(`[annual-report] ${label}:`, e.message);
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const ws = await getCurrentWorkspaceId();
    const year = Number(request.nextUrl.searchParams.get('year')) || new Date().getFullYear();
    if (year < 2000 || year > 2100) throw new ValidationError('Année invalide');
    const y0 = `${year}-01-01`;
    const y1 = `${year + 1}-01-01`;

    // ===== Synthèse ventes =====
    const sales = await safe('sales', async () => {
      const r = await db.query(
        `SELECT COALESCE(SUM(total_amount), 0)::float AS ca,
                COUNT(*)::int AS count,
                COUNT(DISTINCT client_id)::int AS clients
         FROM sales
         WHERE workspace_id = $1 AND sale_date >= $2 AND sale_date < $3 AND status != 'cancelled'`,
        [ws, y0, y1]
      );
      const row = r.rows[0];
      return {
        ca: Math.round(row.ca),
        count: row.count,
        clients: row.clients,
        avgBasket: row.count ? Math.round(row.ca / row.count) : 0,
      };
    }, { ca: 0, count: 0, clients: 0, avgBasket: 0 });

    // ===== Par stand =====
    const byOutlet = await safe('byOutlet', async () => (await db.query(
      `SELECT o.name, COALESCE(SUM(s.total_amount), 0)::float AS ca, COUNT(s.id)::int AS sales
       FROM outlets o
       LEFT JOIN sales s ON s.outlet_id = o.id AND s.sale_date >= $2 AND s.sale_date < $3 AND s.status != 'cancelled'
       WHERE o.workspace_id = $1
       GROUP BY o.id, o.name HAVING COUNT(s.id) > 0
       ORDER BY ca DESC`,
      [ws, y0, y1]
    )).rows.map((r: any) => ({ name: r.name, ca: Math.round(r.ca), sales: r.sales })), []);

    // ===== Par vendeur (CA + primes terrain) =====
    const bySeller = await safe('bySeller', async () => (await db.query(
      `SELECT u.full_name AS name,
              COALESCE(SUM(s.total_amount), 0)::float AS ca,
              COUNT(s.id)::int AS sales,
              COALESCE((SELECT SUM(cp.amount)::float FROM commission_payouts cp
                        WHERE cp.seller_user_id = u.id AND cp.workspace_id = $1
                          AND cp.payout_date >= $2 AND cp.payout_date < $3), 0) AS primes,
              COALESCE((SELECT COUNT(DISTINCT cp.payout_date)::int FROM commission_payouts cp
                        WHERE cp.seller_user_id = u.id AND cp.workspace_id = $1 AND cp.kind = 'transport'
                          AND cp.payout_date >= $2 AND cp.payout_date < $3), 0) AS days
       FROM users u
       JOIN sales s ON s.sales_person_id = u.id AND s.sale_date >= $2 AND s.sale_date < $3 AND s.status != 'cancelled'
       WHERE s.workspace_id = $1
       GROUP BY u.id, u.full_name
       ORDER BY ca DESC`,
      [ws, y0, y1]
    )).rows.map((r: any) => ({
      name: r.name, ca: Math.round(r.ca), sales: r.sales,
      primes: Math.round(r.primes), days: r.days,
    })), []);

    // ===== Dépenses =====
    const expenses = await safe('expenses', async () => {
      const r = await db.query(
        `SELECT COALESCE(c.label, 'Sans catégorie') AS category,
                COALESCE(SUM(e.amount), 0)::float AS total, COUNT(*)::int AS count
         FROM expenses e
         LEFT JOIN expense_categories c ON c.id = e.category_id
         WHERE e.workspace_id = $1 AND e.status = 'paid'
           AND COALESCE(e.payment_date, e.created_at) >= $2 AND COALESCE(e.payment_date, e.created_at) < $3
         GROUP BY COALESCE(c.label, 'Sans catégorie')
         ORDER BY total DESC`,
        [ws, y0, y1]
      );
      const list = r.rows.map((row: any) => ({ category: row.category, total: Math.round(row.total), count: row.count }));
      return { list, total: list.reduce((s: number, x: any) => s + x.total, 0) };
    }, { list: [], total: 0 });

    // ===== RH & paie =====
    const hr = await safe('hr', async () => {
      const staff = (await db.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS actifs,
                COUNT(*) FILTER (WHERE hire_date >= $2 AND hire_date < $3)::int AS embauches
         FROM employees WHERE workspace_id = $1`,
        [ws, y0, y1]
      )).rows[0];
      const pay = (await db.query(
        `SELECT COALESCE(SUM(COALESCE(gross_total, base_salary)), 0)::float AS brut,
                COALESCE(SUM(COALESCE(amount_paid, 0)), 0)::float AS nets_verses,
                COALESCE(SUM(net_salary), 0)::float AS nets_dus,
                COALESCE(SUM(COALESCE(employer_total, 0)), 0)::float AS charges_patronales,
                COALESCE(SUM(COALESCE(cnps_employee, 0) + COALESCE(its_amount, 0)), 0)::float AS retenues,
                COUNT(*)::int AS bulletins
         FROM payrolls
         WHERE workspace_id = $1 AND period LIKE $2 AND status != 'cancelled'`,
        [ws, `${year}-%`]
      )).rows[0];
      const primes = (await db.query(
        `SELECT COALESCE(SUM(amount), 0)::float AS total,
                COALESCE(SUM(amount) FILTER (WHERE kind = 'transport'), 0)::float AS transport,
                COALESCE(SUM(amount) FILTER (WHERE kind = 'sales_bonus'), 0)::float AS vente
         FROM commission_payouts
         WHERE workspace_id = $1 AND payout_date >= $2 AND payout_date < $3`,
        [ws, y0, y1]
      )).rows[0];
      return {
        actifs: staff.actifs, embauches: staff.embauches, bulletins: pay.bulletins,
        masseBrute: Math.round(pay.brut), netsVerses: Math.round(pay.nets_verses),
        netsDus: Math.round(pay.nets_dus), retenues: Math.round(pay.retenues),
        chargesPatronales: Math.round(pay.charges_patronales),
        salairesRestants: Math.max(0, Math.round(pay.nets_dus - pay.nets_verses)),
        primesTerrain: Math.round(primes.total),
        primesTransport: Math.round(primes.transport),
        primesVente: Math.round(primes.vente),
      };
    }, { actifs: 0, embauches: 0, bulletins: 0, masseBrute: 0, netsVerses: 0, netsDus: 0, retenues: 0, chargesPatronales: 0, salairesRestants: 0, primesTerrain: 0, primesTransport: 0, primesVente: 0 });

    // ===== Charges patronales : dues vs réglées (par organisme) =====
    const charges = await safe('charges', async () => {
      const due = (await db.query(
        `SELECT COALESCE(SUM(COALESCE(cnps_employee, 0)), 0)::float AS cnps_sal,
                COALESCE(SUM(COALESCE(employer_total, 0)), 0)::float AS employer_total,
                COALESCE(SUM(COALESCE((employer_charges->>'fdfpApprenticeship')::numeric, 0)
                  + COALESCE((employer_charges->>'fdfpContinuingTraining')::numeric, 0)), 0)::float AS fdfp,
                COALESCE(SUM(COALESCE(its_amount, 0)), 0)::float AS its
         FROM payrolls
         WHERE workspace_id = $1 AND period LIKE $2
           AND (status = 'paid' OR COALESCE(amount_paid, 0) > 0)`,
        [ws, `${year}-%`]
      )).rows[0];
      const paid = (await db.query(
        `SELECT organism, COALESCE(SUM(amount), 0)::float AS paid
         FROM charge_settlements
         WHERE workspace_id = $1 AND period LIKE $2
         GROUP BY organism`,
        [ws, `${year}-%`]
      )).rows;
      const paidMap: Record<string, number> = {};
      for (const p of paid) paidMap[p.organism] = Math.round(p.paid);
      const cnpsDue = Math.round(due.cnps_sal + (due.employer_total - due.fdfp));
      const items = [
        { organism: 'CNPS', due: cnpsDue, paid: paidMap.CNPS ?? 0 },
        { organism: 'DGI — ITS', due: Math.round(due.its), paid: paidMap.DGI ?? 0 },
        { organism: 'FDFP', due: Math.round(due.fdfp), paid: paidMap.FDFP ?? 0 },
      ].map(i => ({ ...i, remaining: Math.max(0, i.due - i.paid) }));
      return { items, totalDue: items.reduce((s, i) => s + i.due, 0), totalRemaining: items.reduce((s, i) => s + i.remaining, 0) };
    }, { items: [], totalDue: 0, totalRemaining: 0 });

    // ===== Production & matières premières =====
    const production = await safe('production', async () => {
      const prod = (await db.query(
        `SELECT COALESCE(SUM(produced_quantity), 0)::float AS qty,
                COALESCE(SUM(total_cost), 0)::float AS cost,
                COUNT(*)::int AS orders
         FROM production_orders
         WHERE workspace_id = $1 AND status = 'completed'
           AND COALESCE(actual_end_date, planned_end_date) >= $2
           AND COALESCE(actual_end_date, planned_end_date) < $3`,
        [ws, y0, y1]
      )).rows[0];
      const mp = (await db.query(
        `SELECT COALESCE(SUM(qty), 0)::float AS qty, COALESCE(SUM(total_cost), 0)::float AS cost
         FROM ingredient_receptions
         WHERE workspace_id = $1 AND received_at >= $2 AND received_at < $3`,
        [ws, y0, y1]
      )).rows[0];
      return {
        producedQty: Math.round(prod.qty), productionCost: Math.round(prod.cost), orders: prod.orders,
        mpQty: Math.round(mp.qty), mpCost: Math.round(mp.cost),
      };
    }, { producedQty: 0, productionCost: 0, orders: 0, mpQty: 0, mpCost: 0 });

    // ===== Produits les plus rentables (marge estimée sur coût stock) =====
    const topProducts = await safe('topProducts', async () => (await db.query(
      `SELECT COALESCE(p.name, si.product_name) AS name,
              SUM(si.quantity)::float AS qty,
              SUM(si.total_price)::float AS ca,
              AVG(st.unit_cost)::float AS unit_cost
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN LATERAL (
         SELECT AVG(unit_cost)::float AS unit_cost FROM stock_items
         WHERE product_id = si.product_id AND unit_cost > 0
       ) st ON true
       WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.sale_date < $3 AND s.status != 'cancelled'
       GROUP BY COALESCE(p.name, si.product_name)
       ORDER BY ca DESC
       LIMIT 10`,
      [ws, y0, y1]
    )).rows.map((r: any) => {
      const ca = Math.round(r.ca);
      const margin = r.unit_cost ? Math.round(r.ca - r.qty * r.unit_cost) : null;
      return {
        name: r.name, qty: Math.round(r.qty), ca,
        margin, marginRate: margin !== null && ca > 0 ? Math.round((margin / ca) * 100) : null,
      };
    }), []);

    // ===== Tableau mensuel =====
    const monthly = await safe('monthly', async () => {
      const caR = (await db.query(
        `SELECT EXTRACT(MONTH FROM sale_date)::int AS m,
                COALESCE(SUM(total_amount), 0)::float AS ca, COUNT(*)::int AS sales
         FROM sales WHERE workspace_id = $1 AND sale_date >= $2 AND sale_date < $3 AND status != 'cancelled'
         GROUP BY 1`,
        [ws, y0, y1]
      )).rows;
      const expR = (await db.query(
        `SELECT EXTRACT(MONTH FROM COALESCE(payment_date, created_at))::int AS m,
                COALESCE(SUM(amount), 0)::float AS total
         FROM expenses WHERE workspace_id = $1 AND status = 'paid'
           AND COALESCE(payment_date, created_at) >= $2 AND COALESCE(payment_date, created_at) < $3
         GROUP BY 1`,
        [ws, y0, y1]
      )).rows;
      const prodR = await safe('monthly-prod', async () => (await db.query(
        `SELECT EXTRACT(MONTH FROM COALESCE(actual_end_date, planned_end_date))::int AS m,
                COALESCE(SUM(produced_quantity), 0)::float AS qty,
                COALESCE(SUM(total_cost), 0)::float AS cost
         FROM production_orders WHERE workspace_id = $1 AND status = 'completed'
           AND COALESCE(actual_end_date, planned_end_date) >= $2
           AND COALESCE(actual_end_date, planned_end_date) < $3
         GROUP BY 1`,
        [ws, y0, y1]
      )).rows, []);
      const salR = await safe('monthly-sal', async () => (await db.query(
        `SELECT SUBSTRING(period FROM 6)::int AS m, COALESCE(SUM(COALESCE(amount_paid, 0)), 0)::float AS nets
         FROM payrolls WHERE workspace_id = $1 AND period LIKE $2 AND status != 'cancelled'
         GROUP BY 1`,
        [ws, `${year}-%`]
      )).rows, []);

      const get = (rows: any[], m: number, f: string) => Number(rows.find((r: any) => r.m === m)?.[f]) || 0;
      return Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const ca = Math.round(get(caR, m, 'ca'));
        const exp = Math.round(get(expR, m, 'total'));
        return {
          month: m,
          productionQty: Math.round(get(prodR, m, 'qty')),
          productionCost: Math.round(get(prodR, m, 'cost')),
          ca,
          sales: get(caR, m, 'sales'),
          expenses: exp,
          salairesNets: Math.round(get(salR, m, 'nets')),
          margin: ca - exp,
        };
      });
    }, []);

    return NextResponse.json({
      data: {
        year,
        generatedAt: new Date().toISOString(),
        sales, byOutlet, bySeller, expenses, hr, charges, production, topProducts, monthly,
        result: { grossMargin: sales.ca - expenses.total },
      },
    });
  } catch (error) {
    return handleApiError(error, 'Erreur lors de la génération du rapport annuel');
  }
}
