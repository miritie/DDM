/**
 * GET /api/outlets/planning?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   Vue agrégée du planning sur une plage : assignments hebdo + overrides.
 *   Renvoie aussi la liste des outlets et des commerciaux disponibles.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.OUTLET_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || new Date().toISOString().slice(0, 10);
    const to = searchParams.get('to') || from;

    const [outlets, agents, assignments, overrides] = await Promise.all([
      db.query(
        `SELECT id, code, name, city
         FROM outlets WHERE workspace_id = $1 AND is_active = true
         ORDER BY name`,
        [workspaceId]
      ),
      db.query(
        `SELECT DISTINCT u.id, u.username, u.full_name
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.workspace_id = $1 AND u.is_active = true
           AND r.role_id IN ('agent_commercial', 'commercial')
         ORDER BY u.full_name`,
        [workspaceId]
      ),
      db.query(
        `SELECT a.id, a.outlet_id, a.user_id, a.week_start, a.week_end, a.notes,
                u.full_name AS user_name, o.name AS outlet_name
         FROM outlet_assignments a
         JOIN users u ON u.id = a.user_id
         JOIN outlets o ON o.id = a.outlet_id
         WHERE a.workspace_id = $1
           AND a.week_start <= $3 AND a.week_end >= $2
         ORDER BY a.week_start, o.name`,
        [workspaceId, from, to]
      ),
      db.query(
        `SELECT ov.id, ov.outlet_id, ov.user_id, ov.date_from, ov.date_to, ov.reason,
                u.full_name AS user_name, o.name AS outlet_name
         FROM outlet_assignment_overrides ov
         JOIN users u ON u.id = ov.user_id
         JOIN outlets o ON o.id = ov.outlet_id
         WHERE ov.workspace_id = $1
           AND ov.date_from <= $3 AND ov.date_to >= $2
         ORDER BY ov.date_from`,
        [workspaceId, from, to]
      ),
    ]);

    return NextResponse.json({
      data: {
        period: { from, to },
        outlets: outlets.rows,
        agents: agents.rows,
        assignments: assignments.rows.map(toIso),
        overrides: overrides.rows.map(toIso),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

function toIso(r: any): any {
  return Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v])
  );
}
