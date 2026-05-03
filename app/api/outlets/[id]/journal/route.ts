/**
 * GET /api/outlets/[id]/journal?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=...
 *   Journal de ventes pour un outlet (toutes ventes, ou filtré par commercial).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

const db = getPostgresClient();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id: outletId } = await params;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10);
    const userId = searchParams.get('userId');

    const params2: any[] = [outletId, from, to];
    let where = `s.outlet_id = $1 AND s.sale_date >= $2 AND s.sale_date <= $3 AND s.status != 'cancelled'`;
    if (userId) {
      params2.push(userId);
      where += ` AND s.sales_person_id = $${params2.length}`;
    }

    const sales = await db.query(
      `SELECT s.id, s.sale_number, s.sale_date, s.client_name, s.total_amount,
              s.amount_paid, s.payment_status, s.status,
              u.full_name AS sales_person_name
       FROM sales s
       JOIN users u ON u.id = s.sales_person_id
       WHERE ${where}
       ORDER BY s.sale_date DESC, s.created_at DESC`,
      params2
    );

    const totals = await db.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(total_amount), 0) AS total,
              COALESCE(SUM(amount_paid), 0) AS paid
       FROM sales
       WHERE outlet_id = $1 AND sale_date >= $2 AND sale_date <= $3 AND status != 'cancelled'`,
      [outletId, from, to]
    );

    const bySeller = await db.query(
      `SELECT u.id AS user_id, u.full_name,
              COUNT(s.id) AS sales_count,
              COALESCE(SUM(s.total_amount), 0) AS total
       FROM sales s
       JOIN users u ON u.id = s.sales_person_id
       WHERE s.outlet_id = $1 AND s.sale_date >= $2 AND s.sale_date <= $3 AND s.status != 'cancelled'
       GROUP BY u.id, u.full_name
       ORDER BY total DESC`,
      [outletId, from, to]
    );

    return NextResponse.json({
      data: {
        period: { from, to },
        totals: {
          count: parseInt(totals.rows[0].count, 10),
          total: Number(totals.rows[0].total),
          paid: Number(totals.rows[0].paid),
        },
        sales: sales.rows,
        bySeller: bySeller.rows.map((r: any) => ({
          userId: r.user_id, name: r.full_name,
          salesCount: parseInt(r.sales_count, 10), total: Number(r.total),
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
