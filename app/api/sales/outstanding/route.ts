/**
 * GET /api/sales/outstanding
 *   Liste les ventes avec balance > 0 (à recouvrer).
 *   Filtres : outletId, clientId, salesPersonId, olderThanDays.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);

    const params: any[] = [workspaceId];
    let where = `s.workspace_id = $1 AND s.balance > 0 AND s.status != 'cancelled'`;

    const outletId = searchParams.get('outletId');
    if (outletId) {
      params.push(outletId);
      where += ` AND s.outlet_id = $${params.length}`;
    }
    const clientId = searchParams.get('clientId');
    if (clientId) {
      params.push(clientId);
      where += ` AND s.client_id = $${params.length}`;
    }
    const salesPersonId = searchParams.get('salesPersonId');
    if (salesPersonId) {
      params.push(salesPersonId);
      where += ` AND s.sales_person_id = $${params.length}`;
    }
    const older = Number(searchParams.get('olderThanDays') || 0);
    if (older > 0) {
      params.push(older);
      where += ` AND s.sale_date < CURRENT_DATE - ($${params.length} || ' days')::interval`;
    }

    const sales = await db.query(
      `SELECT s.id, s.sale_number, s.sale_date, s.client_name, s.client_id,
              s.total_amount, s.amount_paid, s.balance, s.payment_status,
              o.name AS outlet_name, u.full_name AS sales_person_name,
              CURRENT_DATE - DATE(s.sale_date) AS days_old
       FROM sales s
       LEFT JOIN outlets o ON o.id = s.outlet_id
       LEFT JOIN users u ON u.id = s.sales_person_id
       WHERE ${where}
       ORDER BY s.sale_date ASC`,
      params
    );

    const totals = await db.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(balance), 0) AS total_due,
              COALESCE(SUM(total_amount), 0) AS total_amount,
              COALESCE(SUM(amount_paid), 0) AS total_paid
       FROM sales WHERE ${where}`,
      params
    );

    return NextResponse.json({
      data: {
        sales: sales.rows.map((r: any) => ({
          ...r,
          sale_date: r.sale_date instanceof Date ? r.sale_date.toISOString().slice(0, 10) : r.sale_date,
          total_amount: Number(r.total_amount),
          amount_paid: Number(r.amount_paid),
          balance: Number(r.balance),
          days_old: Number(r.days_old),
        })),
        totals: {
          count: parseInt(totals.rows[0].count, 10),
          totalDue: Number(totals.rows[0].total_due),
          totalAmount: Number(totals.rows[0].total_amount),
          totalPaid: Number(totals.rows[0].total_paid),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
