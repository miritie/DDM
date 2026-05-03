/**
 * POST /api/outlets/activation
 *   Active ou désactive plusieurs outlets pour un mois donné, en lot.
 *   body: {
 *     periodYear: number, periodMonth: number,
 *     activations: [{
 *       outletId, isActive, isPaid?, feeAmount?, feePeriod?, notes?
 *     }, ...]
 *   }
 *   → Pour chaque entrée, crée un outlet_period sur le mois (1er → dernier jour).
 *
 * GET /api/outlets/activation?year=&month=
 *   Retourne, pour chaque outlet du workspace, sa période active sur ce mois (ou null).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { OutletService } from '@/lib/modules/outlets/outlet-service';
import { getPostgresClient } from '@/lib/database/postgres-client';

const service = new OutletService();
const db = getPostgresClient();

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get('year') || new Date().getFullYear());
    const month = Number(searchParams.get('month') || new Date().getMonth() + 1);
    const { start, end } = monthBounds(year, month);

    const outlets = await db.query(
      `SELECT id, code, name, city,
              (SELECT json_build_object(
                  'id', p.id, 'startDate', p.start_date, 'endDate', p.end_date,
                  'isActive', p.is_active, 'isPaid', p.is_paid,
                  'feeAmount', p.fee_amount, 'feePeriod', p.fee_period, 'notes', p.notes
                )
                FROM outlet_periods p
                WHERE p.outlet_id = o.id
                  AND p.start_date <= $3
                  AND (p.end_date IS NULL OR p.end_date >= $2)
                ORDER BY p.start_date DESC LIMIT 1
              ) AS current_period
       FROM outlets o
       WHERE o.workspace_id = $1
       ORDER BY o.name`,
      [workspaceId, start, end]
    );

    return NextResponse.json({
      data: {
        period: { year, month, start, end },
        outlets: outlets.rows.map((r: any) => ({
          id: r.id, code: r.code, name: r.name, city: r.city,
          period: r.current_period,
        })),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();
    const { periodYear, periodMonth, activations } = body;
    if (!periodYear || !periodMonth || !Array.isArray(activations)) {
      return NextResponse.json({ error: 'periodYear, periodMonth, activations[] requis' }, { status: 400 });
    }
    const { start, end } = monthBounds(periodYear, periodMonth);

    const created: any[] = [];
    for (const a of activations) {
      if (!a.outletId) continue;
      const period = await service.createPeriod({
        workspaceId,
        outletId: a.outletId,
        startDate: start,
        endDate: end,
        isActive: a.isActive !== false,
        isPaid: !!a.isPaid,
        feeAmount: Number(a.feeAmount) || 0,
        feePeriod: a.feePeriod || 'monthly',
        notes: a.notes,
      });
      // Synchronise le flag is_active sur l'outlet pour qu'il (n')apparaisse (pas) côté POS
      await db.query(`UPDATE outlets SET is_active = $1 WHERE id = $2`, [a.isActive !== false, a.outletId]);
      created.push(period);
    }

    return NextResponse.json({ data: { count: created.length, periods: created } }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
