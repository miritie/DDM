/**
 * GET /api/outlets/{id}/daily-report?date=YYYY-MM-DD
 *
 * Renvoie l'agrégat journalier d'un stand pour générer le journal PDF :
 *   - infos outlet (nom)
 *   - session(s) POS du jour : horaires, closing cash, discordance
 *   - ventes du jour groupées par produit (qty, ca)
 *   - ventes du jour groupées par commercial (nb ventes, ca)
 *   - dépôts caisse du jour par destination
 *   - totaux globaux
 *
 * Permission : sales:view (lecture).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    const outletRes = await db.query<any>(
      `SELECT id, name, code FROM outlets WHERE id::text = $1 OR code = $1 LIMIT 1`,
      [id]
    );
    if (outletRes.rows.length === 0) {
      return NextResponse.json({ error: 'Outlet introuvable' }, { status: 404 });
    }
    const outlet = outletRes.rows[0];

    // ===== Sessions POS du jour =====
    const sessionsRes = await db.query<any>(
      `SELECT s.id, s.started_at, s.ended_at,
              s.closing_cash_expected, s.closing_cash_counted, s.closing_discrepancy,
              s.notes,
              u.full_name AS user_name
       FROM pos_sessions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.outlet_id = $1 AND s.workspace_id = $2
         AND DATE(s.started_at) = $3::date
       ORDER BY s.started_at`,
      [outlet.id, workspaceId, date]
    );
    const sessions = sessionsRes.rows.map((r: any) => ({
      id: r.id,
      userName: r.user_name,
      startedAt: r.started_at?.toISOString?.() ?? r.started_at,
      endedAt: r.ended_at?.toISOString?.() ?? r.ended_at,
      closingCashExpected: r.closing_cash_expected !== null ? Number(r.closing_cash_expected) : null,
      closingCashCounted: r.closing_cash_counted !== null ? Number(r.closing_cash_counted) : null,
      closingDiscrepancy: r.closing_discrepancy !== null ? Number(r.closing_discrepancy) : null,
      notes: r.notes ?? null,
    }));

    // ===== Ventes par produit =====
    const byProductRes = await db.query<any>(
      `SELECT p.name AS product_name, p.code AS product_code,
              SUM(si.quantity)::float AS qty,
              SUM(si.total_price)::float AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN products p ON p.id = si.product_id
       WHERE s.outlet_id = $1 AND s.workspace_id = $2
         AND DATE(s.sale_date) = $3::date
         AND s.status <> 'cancelled'
       GROUP BY p.id, p.name, p.code
       ORDER BY revenue DESC`,
      [outlet.id, workspaceId, date]
    );
    const byProduct = byProductRes.rows.map((r: any) => ({
      name: r.product_name, code: r.product_code,
      qty: Number(r.qty), revenue: Number(r.revenue),
    }));

    // ===== Ventes par commercial =====
    const bySellerRes = await db.query<any>(
      `SELECT u.full_name AS seller_name,
              COUNT(DISTINCT s.id)::int AS sales_count,
              SUM(s.total_amount)::float AS revenue,
              SUM(s.amount_paid)::float AS paid
       FROM sales s
       LEFT JOIN users u ON u.id = s.sales_person_id
       WHERE s.outlet_id = $1 AND s.workspace_id = $2
         AND DATE(s.sale_date) = $3::date
         AND s.status <> 'cancelled'
       GROUP BY u.id, u.full_name
       ORDER BY revenue DESC`,
      [outlet.id, workspaceId, date]
    );
    const bySeller = bySellerRes.rows.map((r: any) => ({
      name: r.seller_name ?? '(inconnu)',
      salesCount: r.sales_count,
      revenue: Number(r.revenue),
      paid: Number(r.paid),
    }));

    // ===== Dépôts caisse du jour =====
    const depositsRes = await db.query<any>(
      `SELECT destination_type, destination_label,
              w.name AS dest_wallet_name,
              SUM(cd.amount)::float AS total,
              COUNT(*)::int AS count
       FROM cash_deposits cd
       LEFT JOIN wallets w ON w.id = cd.destination_wallet_id
       WHERE cd.outlet_id = $1 AND cd.workspace_id = $2
         AND DATE(cd.deposited_at) = $3::date
       GROUP BY destination_type, destination_label, w.name
       ORDER BY total DESC`,
      [outlet.id, workspaceId, date]
    );
    const deposits = depositsRes.rows.map((r: any) => ({
      destinationType: r.destination_type,
      label: r.dest_wallet_name ?? r.destination_label ?? '—',
      total: Number(r.total),
      count: r.count,
    }));

    // ===== Totaux =====
    const totals = {
      salesCount: bySeller.reduce((s, x) => s + x.salesCount, 0),
      revenue: bySeller.reduce((s, x) => s + x.revenue, 0),
      paid: bySeller.reduce((s, x) => s + x.paid, 0),
      deposited: deposits.reduce((s, x) => s + x.total, 0),
    };

    return NextResponse.json({
      data: {
        outlet: { id: outlet.id, name: outlet.name, code: outlet.code },
        date,
        sessions, byProduct, bySeller, deposits, totals,
      },
    });
  } catch (e: any) {
    console.error('daily-report error:', e);
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
