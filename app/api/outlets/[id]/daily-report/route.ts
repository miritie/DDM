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

    // ===== Ventes par produit + inventaire ouverture/fermeture =====
    // Inventaire FERMETURE = stock actuel sur l'outlet (instantané).
    // Inventaire OUVERTURE = closing + ventes_jour + transferts_sortants_jour
    //                         - transferts_entrants_jour (confirmés).
    // On agrège ces 4 sources en UN SEUL query par produit pour rester
    // efficace même avec un gros catalogue.
    const byProductRes = await db.query<any>(
      `WITH sold AS (
         SELECT p.id AS product_id, p.name AS product_name, p.code AS product_code,
                SUM(si.quantity)::float AS qty,
                SUM(si.total_price)::float AS revenue
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN products p ON p.id = si.product_id
         WHERE s.outlet_id = $1 AND s.workspace_id = $2
           AND DATE(s.sale_date) = $3::date
           AND s.status <> 'cancelled'
         GROUP BY p.id, p.name, p.code
       ),
       transfers_in AS (
         SELECT stl.product_id, SUM(stl.qty_received)::float AS qty
         FROM stock_transfer_lines stl
         JOIN stock_transfers st ON st.id = stl.transfer_id
         WHERE stl.destination_outlet_id = $1
           AND stl.leg_status = 'confirmed'
           AND DATE(st.created_at) = $3::date
         GROUP BY stl.product_id
       ),
       transfers_out AS (
         SELECT stl.product_id, SUM(stl.qty_sent)::float AS qty
         FROM stock_transfer_lines stl
         JOIN stock_transfers st ON st.id = stl.transfer_id
         WHERE st.source_outlet_id = $1
           AND DATE(st.created_at) = $3::date
         GROUP BY stl.product_id
       ),
       closing AS (
         SELECT product_id, quantity::float AS qty
         FROM stock_items
         WHERE outlet_id = $1 AND workspace_id = $2
       )
       SELECT
         COALESCE(s.product_id, c.product_id) AS product_id,
         COALESCE(s.product_name, (SELECT name FROM products WHERE id = c.product_id)) AS product_name,
         COALESCE(s.product_code, (SELECT code FROM products WHERE id = c.product_id)) AS product_code,
         COALESCE(s.qty, 0) AS sold_qty,
         COALESCE(s.revenue, 0) AS revenue,
         COALESCE(c.qty, 0) AS closing_qty,
         COALESCE(ti.qty, 0) AS in_qty,
         COALESCE(to_.qty, 0) AS out_qty,
         (COALESCE(c.qty, 0) + COALESCE(s.qty, 0) + COALESCE(to_.qty, 0) - COALESCE(ti.qty, 0)) AS opening_qty
       FROM sold s
       FULL OUTER JOIN closing c ON c.product_id = s.product_id
       LEFT JOIN transfers_in ti ON ti.product_id = COALESCE(s.product_id, c.product_id)
       LEFT JOIN transfers_out to_ ON to_.product_id = COALESCE(s.product_id, c.product_id)
       WHERE COALESCE(s.qty, 0) > 0 OR COALESCE(c.qty, 0) > 0
       ORDER BY COALESCE(s.revenue, 0) DESC, product_name ASC`,
      [outlet.id, workspaceId, date]
    );
    const byProduct = byProductRes.rows.map((r: any) => ({
      name: r.product_name ?? '(inconnu)',
      code: r.product_code ?? '',
      qty: Number(r.sold_qty),
      revenue: Number(r.revenue),
      openingInventory: Number(r.opening_qty),
      closingInventory: Number(r.closing_qty),
      transfersIn: Number(r.in_qty),
      transfersOut: Number(r.out_qty),
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

    // ===== Primes versées en espèces (transport + vente) =====
    let payouts: any[] = [];
    try {
      const payoutsRes = await db.query<any>(
        `SELECT cp.kind, cp.units, cp.amount::float AS amount, u.full_name AS seller_name
         FROM commission_payouts cp
         JOIN users u ON u.id = cp.seller_user_id
         WHERE cp.outlet_id = $1 AND cp.payout_date = $2::date
         ORDER BY u.full_name, cp.kind`,
        [outlet.id, date]
      );
      payouts = payoutsRes.rows.map((r: any) => ({
        kind: r.kind,
        sellerName: r.seller_name,
        units: r.units,
        amount: Number(r.amount),
      }));
    } catch { /* table absente tant que le module paie n'a pas tourné */ }

    // ===== Observation du jour (saisie commercial) =====
    const obsRes = await db.query<any>(
      `SELECT o.observation, o.updated_at, u.full_name AS author_name
       FROM outlet_daily_observations o
       LEFT JOIN users u ON u.id = o.author_id
       WHERE o.outlet_id = $1 AND o.observation_date = $2::date
       LIMIT 1`,
      [outlet.id, date]
    );
    const observation = obsRes.rows[0]
      ? {
          text: obsRes.rows[0].observation as string,
          authorName: obsRes.rows[0].author_name as string | null,
          updatedAt: obsRes.rows[0].updated_at,
        }
      : null;

    // ===== Totaux =====
    const totals = {
      salesCount: bySeller.reduce((s, x) => s + x.salesCount, 0),
      revenue: bySeller.reduce((s, x) => s + x.revenue, 0),
      paid: bySeller.reduce((s, x) => s + x.paid, 0),
      deposited: deposits.reduce((s, x) => s + x.total, 0),
      payouts: payouts.reduce((s, x) => s + x.amount, 0),
    };

    return NextResponse.json({
      data: {
        outlet: { id: outlet.id, name: outlet.name, code: outlet.code },
        date,
        sessions, byProduct, bySeller, deposits, payouts, totals, observation,
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
