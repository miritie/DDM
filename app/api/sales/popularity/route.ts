/**
 * GET /api/sales/popularity?outletId=X&days=30
 *
 * Renvoie les quantités vendues par produit sur la fenêtre glissante
 * donnée (1 ≤ days ≤ 365), agrégées au niveau workspace. Si outletId
 * est fourni, on restreint l'agrégation à ce point de vente — utile
 * pour le POS qui veut afficher en tête les top vendeurs locaux.
 *
 * Les ventes annulées (status='cancelled') sont exclues.
 *
 * Réponse :
 *   { data: [{ productId: string, qtySold: number }] }
 *
 * Pas de cache côté serveur : le calcul est rapide (index sur sales.outlet_id
 * + sale_date) et l'UI cache déjà côté client le résultat le temps de la
 * session. Permission requise : sales:create (= vendre, ce qui suffit
 * pour consulter ce que l'on vend le plus).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALES_CREATE);
    const workspaceId = await getCurrentWorkspaceId();
    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get('outletId');
    // Clamp 1..365, sanitise contre injection (Number direct).
    const daysParam = Number(searchParams.get('days') ?? 30);
    const days = Math.max(1, Math.min(365, Number.isFinite(daysParam) ? daysParam : 30));

    const params: any[] = [workspaceId];
    let outletFilter = '';
    if (outletId) {
      params.push(outletId);
      outletFilter = ` AND s.outlet_id = $${params.length}`;
    }

    // days est garanti entier dans [1, 365] → interpolation sûre.
    const sql = `
      SELECT si.product_id::text AS "productId",
             SUM(si.quantity)::float AS "qtySold"
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.workspace_id = $1
        AND s.status <> 'cancelled'
        AND s.sale_date >= CURRENT_DATE - INTERVAL '${days} days'
        ${outletFilter}
      GROUP BY si.product_id
      ORDER BY SUM(si.quantity) DESC
    `;

    const r = await db.query(sql, params);
    return NextResponse.json({ data: r.rows });
  } catch (e: any) {
    console.error('popularity error:', e);
    return NextResponse.json(
      { error: e.message || 'Erreur calcul popularité' },
      { status: e.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
