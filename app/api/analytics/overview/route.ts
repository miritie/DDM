/**
 * GET /api/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Faits agrégés pour le dashboard décisionnel (/reports) :
 *   - sales    : jour × stand × vendeur (CA, encaissé, crédit, nb ventes)
 *   - products : jour × stand × produit (quantité, CA)
 *   - expenses : jour × catégorie (montant payé)
 *
 * Granularité jour : le client superpose les périodes, filtre en
 * multi-sélection (stands, vendeurs…) et agrège selon la dimension
 * choisie sans refaire d'appel serveur.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { handleApiError, ValidationError } from '@/lib/http/api-error';

const db = getPostgresClient();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new ValidationError('Paramètres from/to requis (YYYY-MM-DD)');
    }

    const [sales, products, expenses] = await Promise.all([
      db.query<any>(
        `SELECT s.sale_date::date::text AS day,
                COALESCE(o.name, '(sans stand)')      AS outlet,
                COALESCE(u.full_name, '(inconnu)')    AS seller,
                COUNT(*)::int                          AS sales_count,
                SUM(s.total_amount)::float             AS revenue,
                SUM(s.amount_paid)::float              AS paid,
                SUM(s.balance)::float                  AS credit
         FROM sales s
         LEFT JOIN outlets o ON o.id = s.outlet_id
         LEFT JOIN users u  ON u.id = s.sales_person_id
         WHERE s.workspace_id::text = $1
           AND s.status <> 'cancelled'
           AND s.sale_date::date BETWEEN $2::date AND $3::date
         GROUP BY 1, 2, 3
         ORDER BY 1`,
        [workspaceId, from, to]
      ),
      db.query<any>(
        `SELECT s.sale_date::date::text AS day,
                COALESCE(o.name, '(sans stand)') AS outlet,
                si.product_name                  AS product,
                SUM(si.quantity)::float          AS qty,
                SUM(si.total_price)::float       AS revenue
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN outlets o ON o.id = s.outlet_id
         WHERE s.workspace_id::text = $1
           AND s.status <> 'cancelled'
           AND s.sale_date::date BETWEEN $2::date AND $3::date
         GROUP BY 1, 2, 3
         ORDER BY 1`,
        [workspaceId, from, to]
      ),
      db.query<any>(
        `SELECT COALESCE(e.payment_date, e.created_at)::date::text AS day,
                COALESCE(ec.label, 'Autres') AS category,
                SUM(e.amount)::float         AS amount
         FROM expenses e
         LEFT JOIN expense_categories ec ON ec.id = e.category_id
         WHERE e.workspace_id::text = $1
           AND e.status = 'paid'
           AND COALESCE(e.payment_date, e.created_at)::date BETWEEN $2::date AND $3::date
         GROUP BY 1, 2
         ORDER BY 1`,
        [workspaceId, from, to]
      ),
    ]);

    return NextResponse.json({
      data: {
        from,
        to,
        sales: sales.rows,
        products: products.rows,
        expenses: expenses.rows,
      },
    });
  } catch (error) {
    return handleApiError(error, 'Erreur lors du chargement des analytics');
  }
}
