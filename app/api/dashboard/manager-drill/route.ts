/**
 * API Route - Détail d'un chiffre du dashboard manager commercial
 * GET /api/dashboard/manager-drill?kpi=<clé>&period=today|week|month
 *
 * Taillé pour le métier commercial : qui vend, où, combien.
 *   sales       → CA PAR STAND + PAR VENDEUR sur la période
 *   stock_value → valeur du stock par stand
 *   ruptures    → produits en rupture, par stand
 *   stock_low   → produits en stock bas, par stand
 *   present     → présence du jour, par vendeur (POS + pointage manuel)
 *   customers   → meilleurs clients par CA (90 j)
 *   pending     → ventes non soldées (crédit en cours)
 *
 * Réponse : { data: { title, groups?: [{heading, rows}], rows? } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { handleApiError, ValidationError } from '@/lib/http/api-error';

const db = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const ws = await getCurrentWorkspaceId();
    const kpi = request.nextUrl.searchParams.get('kpi') || '';
    const period = request.nextUrl.searchParams.get('period') || 'month';

    const today = new Date().toISOString().slice(0, 10);
    const from =
      period === 'today' ? today
      : period === 'week' ? new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
      : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

    type Row = { label: string; value: number | string; sub?: string };
    let data: { title: string; groups?: Array<{ heading: string; rows: Row[] }>; rows?: Row[] };

    switch (kpi) {
      case 'sales': {
        const byOutlet = (await db.query(
          `SELECT o.name AS label, SUM(s.total_amount)::float AS value, COUNT(*)::int AS n
           FROM sales s JOIN outlets o ON o.id = s.outlet_id
           WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.status != 'cancelled'
           GROUP BY o.name ORDER BY value DESC`, [ws, from])).rows;
        const bySeller = (await db.query(
          `SELECT u.full_name AS label, SUM(s.total_amount)::float AS value, COUNT(*)::int AS n
           FROM sales s JOIN users u ON u.id = s.sales_person_id
           WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.status != 'cancelled'
           GROUP BY u.full_name ORDER BY value DESC`, [ws, from])).rows;
        const tot = byOutlet.reduce((a: number, x: any) => a + Number(x.value), 0);
        const map = (rows: any[]) => rows.map((x: any) => ({
          label: x.label, value: Math.round(Number(x.value)),
          sub: `${x.n} vente(s)${tot > 0 ? ' · ' + Math.round((Number(x.value) / tot) * 100) + ' %' : ''}`,
        }));
        data = {
          title: 'Ventes — par stand et par vendeur',
          groups: [
            { heading: 'Par stand', rows: map(byOutlet) },
            { heading: 'Par vendeur', rows: map(bySeller) },
          ],
        };
        break;
      }

      case 'stock_value': {
        const r = (await db.query(
          `SELECT o.name AS label, SUM(si.quantity * COALESCE(si.unit_cost, 0))::float AS value,
                  COUNT(*) FILTER (WHERE si.quantity <= 0)::int AS ruptures
           FROM stock_items si JOIN outlets o ON o.id = si.outlet_id
           WHERE si.workspace_id = $1
           GROUP BY o.name ORDER BY value DESC`, [ws])).rows;
        data = {
          title: 'Stock valorisé — par stand',
          rows: r.map((x: any) => ({
            label: x.label, value: Math.round(Number(x.value)),
            sub: x.ruptures > 0 ? `${x.ruptures} produit(s) en rupture` : undefined,
          })),
        };
        break;
      }

      case 'ruptures':
      case 'stock_low': {
        const cond = kpi === 'ruptures'
          ? 'si.quantity <= 0'
          : 'si.quantity > 0 AND si.quantity <= COALESCE(si.minimum_stock, 0)';
        const r = (await db.query(
          `SELECT p.name AS label, o.name AS outlet, si.quantity::float AS qty, si.minimum_stock::float AS min
           FROM stock_items si
           JOIN products p ON p.id = si.product_id
           JOIN outlets o ON o.id = si.outlet_id
           WHERE si.workspace_id = $1 AND ${cond}
           ORDER BY o.name, p.name LIMIT 60`, [ws])).rows;
        data = {
          title: kpi === 'ruptures' ? 'Produits en rupture — par stand' : 'Produits en stock bas — par stand',
          rows: r.map((x: any) => ({
            label: x.label, value: `${Math.round(x.qty)}`,
            sub: `${x.outlet}${kpi === 'stock_low' ? ` · min ${Math.round(x.min)}` : ''}`,
          })),
        };
        break;
      }

      case 'present': {
        const r = (await db.query(
          `SELECT name AS label, string_agg(DISTINCT outlet, ', ') AS sub FROM (
             SELECT e.full_name AS name, o.name AS outlet
             FROM pos_sessions ps
             JOIN employees e ON e.user_id = ps.user_id AND e.workspace_id = $1
             JOIN outlets o ON o.id = ps.outlet_id
             WHERE ps.workspace_id = $1 AND ps.started_at::date = CURRENT_DATE
             UNION
             SELECT e.full_name AS name, 'pointage manuel' AS outlet
             FROM attendances a
             JOIN employees e ON e.id = a.employee_id
             WHERE a.workspace_id = $1 AND a.date = CURRENT_DATE AND a.check_in_time IS NOT NULL
           ) x GROUP BY name ORDER BY name`, [ws])).rows;
        data = {
          title: "Présents aujourd'hui — par vendeur",
          rows: r.map((x: any) => ({ label: x.label, value: '✓', sub: x.sub })),
        };
        break;
      }

      case 'customers': {
        const r = (await db.query(
          `SELECT COALESCE(c.company_name, c.name) AS label,
                  SUM(s.total_amount)::float AS value, COUNT(*)::int AS n
           FROM sales s JOIN clients c ON c.id = s.client_id
           WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.status != 'cancelled'
           GROUP BY COALESCE(c.company_name, c.name) ORDER BY value DESC LIMIT 20`,
          [ws, new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)])).rows;
        data = {
          title: 'Meilleurs clients (90 jours)',
          rows: r.map((x: any) => ({
            label: x.label, value: Math.round(Number(x.value)), sub: `${x.n} commande(s)`,
          })),
        };
        break;
      }

      case 'pending': {
        const r = (await db.query(
          `SELECT s.sale_number AS label, COALESCE(c.name, o.name, 'Comptoir') AS who,
                  s.balance::float AS bal, s.sale_date
           FROM sales s
           LEFT JOIN clients c ON c.id = s.client_id
           LEFT JOIN outlets o ON o.id = s.outlet_id
           WHERE s.workspace_id = $1 AND s.status != 'cancelled' AND s.balance > 0
           ORDER BY s.balance DESC LIMIT 30`, [ws])).rows;
        data = {
          title: 'Ventes non soldées (crédit en cours)',
          rows: r.map((x: any) => ({
            label: x.label, value: Math.round(Number(x.bal)),
            sub: `${x.who} · ${new Date(x.sale_date).toLocaleDateString('fr-FR')}`,
          })),
        };
        break;
      }

      default:
        throw new ValidationError('kpi inconnu');
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement du détail');
  }
}
