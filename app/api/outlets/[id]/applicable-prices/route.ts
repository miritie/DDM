/**
 * GET /api/outlets/[id]/applicable-prices
 *
 * Renvoie tous les prix actifs applicables sur cet outlet, en combinant :
 *   - prix outlet-spécifiques (priorité 1)
 *   - prix par type d'outlet (priorité 2)
 *
 * Pour chaque produit, on garde uniquement le prix gagnant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getPostgresClient } from '@/lib/database/postgres-client';

const db = getPostgresClient();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const { id: outletId } = await params;

    // Récupère le type d'outlet
    const outlet = await db.query(
      `SELECT outlet_type_id FROM outlets WHERE id = $1 LIMIT 1`,
      [outletId]
    );
    if (outlet.rows.length === 0) {
      return NextResponse.json({ error: 'Outlet introuvable' }, { status: 404 });
    }
    const typeId = outlet.rows[0].outlet_type_id;

    // Sélectionne, par produit, le prix le plus prioritaire actif aujourd'hui :
    //   - priorité 1 : prix outlet
    //   - priorité 2 : prix type
    const r = await db.query(
      `WITH ranked AS (
         SELECT
           op.id, op.product_id, op.unit_price, op.currency,
           op.valid_from, op.valid_to,
           CASE WHEN op.outlet_id IS NOT NULL THEN 1 ELSE 2 END AS prio,
           ROW_NUMBER() OVER (
             PARTITION BY op.product_id
             ORDER BY CASE WHEN op.outlet_id IS NOT NULL THEN 1 ELSE 2 END,
                      op.valid_from DESC
           ) AS rn
         FROM outlet_prices op
         WHERE (op.outlet_id = $1 OR ($2::uuid IS NOT NULL AND op.outlet_type_id = $2))
           AND op.valid_from <= CURRENT_DATE
           AND (op.valid_to IS NULL OR op.valid_to >= CURRENT_DATE)
       )
       SELECT id, product_id, unit_price, currency, valid_from, valid_to, prio
       FROM ranked WHERE rn = 1`,
      [outletId, typeId]
    );

    return NextResponse.json({
      data: r.rows.map((p: any) => ({
        Id: p.id,
        ProductId: p.product_id,
        UnitPrice: Number(p.unit_price),
        Currency: p.currency,
        ValidFrom: p.valid_from instanceof Date ? p.valid_from.toISOString().slice(0,10) : p.valid_from,
        ValidTo: p.valid_to ? (p.valid_to instanceof Date ? p.valid_to.toISOString().slice(0,10) : p.valid_to) : null,
        Source: p.prio === 1 ? 'outlet' : 'type',
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message?.includes('Permission') ? 403 : 500 }
    );
  }
}
