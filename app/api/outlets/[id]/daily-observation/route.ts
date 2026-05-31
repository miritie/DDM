/**
 * API — Observation journalière d'un stand.
 *
 * GET /api/outlets/{id}/daily-observation?date=YYYY-MM-DD
 *   → { observation, authorName, updatedAt } | { observation: null }
 *
 * PUT /api/outlets/{id}/daily-observation
 *   { date: 'YYYY-MM-DD', observation: '…' }
 *   → upsert sur (outlet_id, date). Si observation est vide, supprime.
 *
 * Permission : sales:view pour GET, sales:create pour PUT (le vendeur
 * qui tient le stand peut commenter sa journée).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId, getCurrentUserUuid } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

async function resolveOutletUuid(idOrSlug: string): Promise<string | null> {
  const r = await db.query<any>(
    `SELECT id FROM outlets WHERE id::text = $1 OR code = $1 LIMIT 1`,
    [idOrSlug]
  );
  return r.rows[0]?.id ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    const outletUuid = await resolveOutletUuid(id);
    if (!outletUuid) return NextResponse.json({ error: 'Outlet introuvable' }, { status: 404 });

    const r = await db.query<any>(
      `SELECT o.observation, o.updated_at, u.full_name AS author_name
       FROM outlet_daily_observations o
       LEFT JOIN users u ON u.id = o.author_id
       WHERE o.outlet_id = $1 AND o.observation_date = $2::date
       LIMIT 1`,
      [outletUuid, date]
    );
    const row = r.rows[0];
    return NextResponse.json({
      data: row
        ? { observation: row.observation, authorName: row.author_name, updatedAt: row.updated_at }
        : { observation: null, authorName: null, updatedAt: null },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const { id } = await params;
    const body = await request.json();
    const date = body.date || new Date().toISOString().slice(0, 10);
    const observation = (body.observation ?? '').toString().trim();

    const workspaceId = await getCurrentWorkspaceId();
    const outletUuid = await resolveOutletUuid(id);
    if (!outletUuid) return NextResponse.json({ error: 'Outlet introuvable' }, { status: 404 });

    const authorUuid = await getCurrentUserUuid();

    if (!observation) {
      // Vide → supprime l'entrée si elle existe
      await db.query(
        `DELETE FROM outlet_daily_observations WHERE outlet_id = $1 AND observation_date = $2::date`,
        [outletUuid, date]
      );
      return NextResponse.json({ data: { observation: null } });
    }

    // Upsert sur (outlet_id, observation_date)
    await db.query(
      `INSERT INTO outlet_daily_observations
         (outlet_id, observation_date, observation, author_id, workspace_id)
       VALUES ($1::uuid, $2::date, $3::text, $4::uuid, $5::uuid)
       ON CONFLICT (outlet_id, observation_date) DO UPDATE
         SET observation = EXCLUDED.observation,
             author_id = EXCLUDED.author_id,
             updated_at = CURRENT_TIMESTAMP`,
      [outletUuid, date, observation, authorUuid, workspaceId]
    );

    return NextResponse.json({ data: { observation } });
  } catch (e: any) {
    console.error('daily-observation PUT error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
