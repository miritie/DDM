/**
 * API Route - Détail d'un chiffre de l'état des lieux PCA
 * GET /api/dashboard/pca-drill?kpi=<clé>
 *
 * Chaque KPI de la synthèse est cliquable et renvoie sa décomposition :
 *   ca_day | ca_month | ca_year → CA par point de vente ; les ventes à
 *     un client identifié sont regroupées sous le NOM DU CLIENT (un gros
 *     client est traité comme un point de vente)
 *   stock_stands     → valeur du stock par stand
 *   stock_warehouse  → valeur du stock entrepôt par produit (top 15)
 *   mp_low           → matières premières sous le minimum
 *   expenses_month   → dépenses du mois par catégorie
 *   commitments      → demandes approuvées non encore payées
 *   replenishments   → réapprovisionnements demandés (valorisés)
 *
 * Réponse : { data: { title, rows: [{ label, value, sub? }] } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { handleApiError, ValidationError } from '@/lib/http/api-error';

const db = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const ws = await getCurrentWorkspaceId();
    const kpi = request.nextUrl.searchParams.get('kpi') || '';

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const yearStart = today.slice(0, 4) + '-01-01';

    // CA par point de vente — client identifié = regroupé sous son nom
    const caBy = async (from: string, title: string) => {
      const r = await db.query(
        `SELECT COALESCE(c.name, o.name, 'Hors stand') AS label,
                CASE WHEN c.id IS NOT NULL THEN 'Client' ELSE 'Stand' END AS kind,
                SUM(s.total_amount)::float AS value,
                COUNT(*)::int AS sales
         FROM sales s
         LEFT JOIN clients c ON c.id = s.client_id
         LEFT JOIN outlets o ON o.id = s.outlet_id
         WHERE s.workspace_id = $1 AND s.sale_date >= $2 AND s.status != 'cancelled'
         GROUP BY COALESCE(c.name, o.name, 'Hors stand'), CASE WHEN c.id IS NOT NULL THEN 'Client' ELSE 'Stand' END
         ORDER BY value DESC`,
        [ws, from]
      );
      const total = r.rows.reduce((s: number, x: any) => s + Number(x.value), 0);
      return {
        title,
        rows: r.rows.map((x: any) => ({
          label: x.label,
          value: Math.round(Number(x.value)),
          sub: `${x.kind} · ${x.sales} vente(s) · ${total > 0 ? Math.round((Number(x.value) / total) * 100) : 0} %`,
        })),
      };
    };

    let data: { title: string; rows: Array<{ label: string; value: number | string; sub?: string }> };

    switch (kpi) {
      case 'ca_day': data = await caBy(today, "CA d'aujourd'hui — par point de vente"); break;
      case 'ca_month': data = await caBy(monthStart, 'CA du mois — par point de vente'); break;
      case 'ca_year': data = await caBy(yearStart, "CA de l'année — par point de vente"); break;

      case 'stock_stands': {
        const r = await db.query(
          `SELECT o.name AS label, SUM(si.quantity * COALESCE(si.unit_cost, 0))::float AS value,
                  COUNT(*) FILTER (WHERE si.quantity <= 0)::int AS ruptures
           FROM stock_items si JOIN outlets o ON o.id = si.outlet_id
           WHERE si.workspace_id = $1
           GROUP BY o.name ORDER BY value DESC`,
          [ws]
        );
        data = {
          title: 'Stock valorisé — par stand',
          rows: r.rows.map((x: any) => ({
            label: x.label,
            value: Math.round(Number(x.value)),
            sub: x.ruptures > 0 ? `${x.ruptures} produit(s) en rupture` : undefined,
          })),
        };
        break;
      }

      case 'stock_warehouse': {
        const r = await db.query(
          `SELECT p.name AS label, SUM(si.quantity * COALESCE(si.unit_cost, 0))::float AS value,
                  SUM(si.quantity)::float AS qty
           FROM stock_items si JOIN products p ON p.id = si.product_id
           WHERE si.workspace_id = $1 AND si.warehouse_id IS NOT NULL
           GROUP BY p.name ORDER BY value DESC LIMIT 15`,
          [ws]
        );
        data = {
          title: 'Stock entrepôt — par produit (top 15)',
          rows: r.rows.map((x: any) => ({
            label: x.label,
            value: Math.round(Number(x.value)),
            sub: `${new Intl.NumberFormat('fr-FR').format(Math.round(x.qty))} unité(s)`,
          })),
        };
        break;
      }

      case 'mp_low': {
        const r = await db.query(
          `SELECT name AS label, current_stock::float AS qty, minimum_stock::float AS min, unit
           FROM ingredients
           WHERE workspace_id = $1 AND is_active = true
             AND current_stock <= COALESCE(minimum_stock, 0)
           ORDER BY (current_stock / NULLIF(minimum_stock, 0)) ASC NULLS FIRST`,
          [ws]
        );
        data = {
          title: 'Matières premières sous le minimum',
          rows: r.rows.map((x: any) => ({
            label: x.label,
            value: `${Math.round(x.qty)} ${x.unit}`,
            sub: `minimum : ${Math.round(x.min)} ${x.unit}`,
          })),
        };
        break;
      }

      case 'expenses_month': {
        const r = await db.query(
          `SELECT COALESCE(c.label, 'Sans catégorie') AS label,
                  SUM(e.amount)::float AS value, COUNT(*)::int AS n
           FROM expenses e
           LEFT JOIN expense_categories c ON c.id = e.category_id
           WHERE e.workspace_id = $1 AND e.status = 'paid'
             AND COALESCE(e.payment_date, e.created_at) >= $2
           GROUP BY COALESCE(c.label, 'Sans catégorie')
           ORDER BY value DESC`,
          [ws, monthStart]
        );
        const total = r.rows.reduce((s: number, x: any) => s + Number(x.value), 0);
        data = {
          title: 'Dépenses du mois — par catégorie',
          rows: r.rows.map((x: any) => ({
            label: x.label,
            value: Math.round(Number(x.value)),
            sub: `${x.n} dépense(s) · ${total > 0 ? Math.round((Number(x.value) / total) * 100) : 0} %`,
          })),
        };
        break;
      }

      case 'commitments': {
        const r = await db.query(
          `SELECT er.title AS label, er.amount::float AS value,
                  u.full_name AS requester, er.submitted_at
           FROM expense_requests er
           LEFT JOIN users u ON u.id = er.requester_id
           WHERE er.workspace_id = $1 AND er.status = 'approved'
             AND NOT EXISTS (
               SELECT 1 FROM expenses e
               WHERE e.expense_request_id = er.id AND e.status = 'paid'
             )
           ORDER BY er.amount DESC LIMIT 20`,
          [ws]
        );
        data = {
          title: 'Engagements approuvés, non encore payés',
          rows: r.rows.map((x: any) => ({
            label: x.label,
            value: Math.round(Number(x.value)),
            sub: x.requester ? `sollicité par ${x.requester}` : undefined,
          })),
        };
        break;
      }

      case 'replenishments': {
        const r = await db.query(
          `SELECT o.replenishment_number AS label, u.full_name AS requester, o.status,
                  SUM(l.quantity_requested * COALESCE(l.unit_cost, 0))::float AS value
           FROM stand_replenishment_orders o
           JOIN stand_replenishment_lines l ON l.replenishment_id = o.id
           LEFT JOIN users u ON u.id = o.requested_by_id
           WHERE o.workspace_id = $1
             AND o.status IN ('submitted', 'approved', 'in_production', 'produced')
           GROUP BY o.id, o.replenishment_number, u.full_name, o.status
           ORDER BY value DESC`,
          [ws]
        );
        const statusFr: Record<string, string> = {
          submitted: 'soumis', approved: 'approuvé', in_production: 'en production', produced: 'produit',
        };
        data = {
          title: 'Réapprovisionnements demandés',
          rows: r.rows.map((x: any) => ({
            label: x.label,
            value: Math.round(Number(x.value)),
            sub: `${x.requester ? 'par ' + x.requester + ' · ' : ''}${statusFr[x.status] ?? x.status}`,
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
