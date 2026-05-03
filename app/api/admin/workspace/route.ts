/**
 * GET   /api/admin/workspace  — infos du workspace courant (branding inclus)
 * PATCH /api/admin/workspace  — mise à jour des infos / branding
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

const ALLOWED_FIELDS = [
  'name', 'description', 'slogan', 'address', 'phone', 'email', 'logo_url', 'currency', 'timezone',
];

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const r = await db.query(
      `SELECT id, workspace_id, name, slug, description, slogan, address,
              phone, email, logo_url, currency, timezone, is_active
       FROM workspaces WHERE id = $1`,
      [workspaceId]
    );
    if (r.rows.length === 0) return NextResponse.json({ error: 'Workspace introuvable' }, { status: 404 });
    return NextResponse.json({ data: r.rows[0] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.ADMIN_SETTINGS_EDIT);
    const workspaceId = await getCurrentWorkspaceId();
    const body = await request.json();

    const sets: string[] = [];
    const params: any[] = [];
    for (const f of ALLOWED_FIELDS) {
      if (body[f] !== undefined) {
        params.push(body[f]);
        sets.push(`${f} = $${params.length}`);
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
    params.push(workspaceId);
    const r = await db.query(
      `UPDATE workspaces SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length} RETURNING *`,
      params
    );
    return NextResponse.json({ data: r.rows[0] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
