/**
 * API Route - Dashboard Manager
 * GET /api/dashboard/manager - Données pour le Dashboard Manager
 *
 * Endpoint robuste : chaque bloc de données est isolé et tombe sur 0
 * si la table/colonne n'existe pas dans le schéma courant.
 */

import { NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

async function safeNumber(promise: Promise<any>, key = 'total'): Promise<number> {
  try {
    const r = await promise;
    return parseFloat(r.rows[0]?.[key]) || 0;
  } catch (e: any) {
    console.warn('[manager-dashboard] requête échouée:', e.message);
    return 0;
  }
}

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.SALES_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const db = getPostgresClient();

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Ventes (table sales — colonne client_id)
    const todaySales = await safeNumber(
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND sale_date::date = $2 AND status != 'cancelled'`,
        [workspaceId, today]
      )
    );
    const weekSales = await safeNumber(
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND sale_date >= $2 AND status != 'cancelled'`,
        [workspaceId, weekAgo]
      )
    );
    const monthSales = await safeNumber(
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND sale_date >= $2 AND status != 'cancelled'`,
        [workspaceId, monthAgo]
      )
    );
    const pending = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM sales
         WHERE workspace_id = $1 AND status IN ('draft', 'partially_paid')`,
        [workspaceId]
      )
    );

    // Stock réel (stock_items : quantité × coût unitaire, seuils)
    const totalProducts = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM products WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId]
      )
    );
    const totalStockValue = await safeNumber(
      db.query(
        `SELECT COALESCE(SUM(quantity * COALESCE(unit_cost, 0)), 0) as total
         FROM stock_items WHERE workspace_id = $1`,
        [workspaceId]
      )
    );
    const lowStock = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM stock_items
         WHERE workspace_id = $1 AND quantity > 0 AND quantity <= COALESCE(minimum_stock, 0)`,
        [workspaceId]
      )
    );
    const outOfStock = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM stock_items
         WHERE workspace_id = $1 AND quantity <= 0`,
        [workspaceId]
      )
    );

    // Équipe : la colonne est status (pas is_active) ; les présents
    // combinent pointages manuels ET présence POS automatique des
    // commerciaux (ouverture de caisse du jour)
    const totalEmps = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM employees
         WHERE workspace_id = $1 AND status = 'active'`,
        [workspaceId]
      )
    );
    const present = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM (
           SELECT a.employee_id FROM attendances a
           WHERE a.workspace_id = $1 AND a.date = CURRENT_DATE AND a.check_in_time IS NOT NULL
           UNION
           SELECT e.id FROM pos_sessions ps
           JOIN employees e ON e.user_id = ps.user_id AND e.workspace_id = $1
           WHERE ps.workspace_id = $1 AND ps.started_at::date = CURRENT_DATE
         ) x`,
        [workspaceId]
      )
    );
    const onLeave = await safeNumber(
      db.query(
        `SELECT COUNT(DISTINCT employee_id) as total FROM leaves
         WHERE workspace_id = $1 AND status = 'approved'
           AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`,
        [workspaceId]
      )
    );

    // Clients : la table est « clients » (customers n'a jamais existé)
    const totalCustomers = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM clients WHERE workspace_id = $1`,
        [workspaceId]
      )
    );
    const newCustomers = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM clients
         WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
        [workspaceId, weekAgo]
      )
    );
    const activeCustomers = await safeNumber(
      db.query(
        `SELECT COUNT(DISTINCT client_id) as total FROM sales
         WHERE workspace_id = $1 AND sale_date >= $2 AND client_id IS NOT NULL
           AND status != 'cancelled'`,
        [workspaceId, monthAgo]
      )
    );

    // Alertes
    const alerts: Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
      action?: string;
      link?: string;
    }> = [];

    if (pending > 5) {
      alerts.push({
        type: 'info',
        message: `${pending} ventes en attente de paiement`,
        action: 'Voir les ventes',
        link: '/sales?filter=pending',
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          sales: { today: todaySales, week: weekSales, month: monthSales, pending },
          stock: { lowStock, outOfStock, totalProducts, totalValue: totalStockValue },
          employees: {
            total: totalEmps,
            present,
            absent: Math.max(0, totalEmps - present - onLeave),
            onLeave,
          },
          customers: {
            total: totalCustomers,
            new: newCustomers,
            active: activeCustomers,
          },
          alerts,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching manager dashboard:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
