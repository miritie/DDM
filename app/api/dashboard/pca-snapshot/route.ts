/**
 * API Route - État des lieux PCA (synthèse immédiate)
 * GET /api/dashboard/pca-snapshot
 *
 * Les 9 chiffres dont le PCA a besoin d'entrée de jeu :
 *   CA jour · CA mois · CA année
 *   stock valorisé stands · stock valorisé entrepôts · MP en faible quantité
 *   dépenses du mois exécutées · engagements approuvés non exécutés ·
 *   réapprovisionnements demandés par les commerciaux (valorisés)
 *
 * Chaque bloc est isolé : une table absente renvoie 0 sans casser le reste.
 */

import { NextResponse } from 'next/server';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { handleApiError } from '@/lib/http/api-error';

const db = getPostgresClient();

async function num(sql: string, params: any[], key = 'total'): Promise<number> {
  try {
    const r = await db.query(sql, params);
    return Math.round(Number(r.rows[0]?.[key]) || 0);
  } catch (e: any) {
    console.warn('[pca-snapshot]', e.message);
    return 0;
  }
}

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.REPORTS_VIEW);
    const ws = await getCurrentWorkspaceId();

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const yearStart = today.slice(0, 4) + '-01-01';

    const [caDay, caMonth, caYear, stockStands, stockWarehouse, mpLow,
      expensesMonth, commitments, replenishments] = await Promise.all([
      num(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales
           WHERE workspace_id = $1 AND sale_date::date = $2 AND status != 'cancelled'`, [ws, today]),
      num(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales
           WHERE workspace_id = $1 AND sale_date >= $2 AND status != 'cancelled'`, [ws, monthStart]),
      num(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales
           WHERE workspace_id = $1 AND sale_date >= $2 AND status != 'cancelled'`, [ws, yearStart]),
      num(`SELECT COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0) AS total
           FROM stock_items WHERE workspace_id = $1 AND outlet_id IS NOT NULL`, [ws]),
      num(`SELECT COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0) AS total
           FROM stock_items WHERE workspace_id = $1 AND warehouse_id IS NOT NULL`, [ws]),
      num(`SELECT COUNT(*) AS total FROM ingredients
           WHERE workspace_id = $1 AND is_active = true
             AND current_stock <= COALESCE(minimum_stock, 0)`, [ws]),
      num(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
           WHERE workspace_id = $1 AND status = 'paid'
             AND COALESCE(payment_date, created_at) >= $2`, [ws, monthStart]),
      // Engagements : demandes approuvées dont la dépense n'est pas payée
      num(`SELECT COALESCE(SUM(er.amount), 0) AS total FROM expense_requests er
           WHERE er.workspace_id = $1 AND er.status = 'approved'
             AND NOT EXISTS (
               SELECT 1 FROM expenses e
               WHERE e.expense_request_id = er.id AND e.status = 'paid'
             )`, [ws]),
      // Réapprovisionnements demandés par les commerciaux, pas encore livrés
      num(`SELECT COALESCE(SUM(l.quantity_requested * COALESCE(l.unit_cost, 0)), 0) AS total
           FROM stand_replenishment_lines l
           JOIN stand_replenishment_orders o ON o.id = l.replenishment_id
           WHERE o.workspace_id = $1
             AND o.status IN ('submitted', 'approved', 'in_production', 'produced')`, [ws]),
    ]);

    return NextResponse.json({
      data: {
        ca: { day: caDay, month: caMonth, year: caYear },
        stock: { stands: stockStands, warehouse: stockWarehouse, mpLow },
        engagements: { expensesMonth, pending: commitments, replenishments },
      },
    });
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement de l'état des lieux");
  }
}
