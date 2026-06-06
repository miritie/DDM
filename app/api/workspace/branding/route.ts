/**
 * GET /api/workspace/branding — identité visuelle du workspace courant.
 *
 * Version « lecture seule, tout utilisateur connecté » de
 * /api/admin/workspace (qui exige ADMIN_SETTINGS_VIEW) : les vendeurs en
 * ont besoin pour générer les reçus de vente (logo, slogan, contacts).
 * Aucune donnée sensible : c'est ce qui figure sur les documents remis
 * aux clients.
 */
import { NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { handleApiError } from '@/lib/http/api-error';

const db = getPostgresClient();

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const r = await db.query(
      `SELECT name, slogan, address, phone, email, logo_url, currency
       FROM workspaces WHERE id::text = $1 OR workspace_id = $1 OR slug = $1
       LIMIT 1`,
      [workspaceId]
    );
    if (r.rows.length === 0) {
      return NextResponse.json({ error: 'Workspace introuvable' }, { status: 404 });
    }
    const w = r.rows[0];
    const res = NextResponse.json({
      data: {
        name: w.name,
        slogan: w.slogan,
        address: w.address,
        phone: w.phone,
        email: w.email,
        logoUrl: w.logo_url,
        currency: w.currency || 'XOF',
      },
    });
    // Le branding change rarement : laisse le navigateur le garder 10 min.
    res.headers.set('Cache-Control', 'private, max-age=600');
    return res;
  } catch (error) {
    return handleApiError(error, 'Erreur lors de la récupération du branding');
  }
}
