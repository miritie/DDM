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
    const workspaceId = await getCurrentWorkspaceId();
    const db = getPostgresClient();

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Ventes (table sales — colonne client_id)
    const todaySales = await safeNumber(
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND DATE(created_at) = $2`,
        [workspaceId, today]
      )
    );
    const weekSales = await safeNumber(
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
        [workspaceId, weekAgo]
      )
    );
    const monthSales = await safeNumber(
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
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

    // Stock (les colonnes stock_quantity/stock_minimum n'existent pas dans le schéma actuel — fallback 0)
    const lowStock = 0;
    const outOfStock = 0;
    const totalProducts = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM products WHERE workspace_id = $1`,
        [workspaceId]
      )
    );
    const totalStockValue = 0;

    // Employés (table attendance peut ne pas exister — graceful fallback)
    const totalEmps = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM employees
         WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId]
      )
    );
    const present = await safeNumber(
      db.query(
        `SELECT COUNT(DISTINCT employee_id) as total FROM attendance
         WHERE workspace_id = $1 AND DATE(check_in) = $2`,
        [workspaceId, today]
      )
    );

    // Clients (table customers + sales.client_id)
    const totalCustomers = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM customers WHERE workspace_id = $1`,
        [workspaceId]
      )
    );
    const newCustomers = await safeNumber(
      db.query(
        `SELECT COUNT(*) as total FROM customers
         WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
        [workspaceId, weekAgo]
      )
    );
    const activeCustomers = await safeNumber(
      db.query(
        `SELECT COUNT(DISTINCT client_id) as total FROM sales
         WHERE workspace_id = $1 AND DATE(created_at) >= $2 AND client_id IS NOT NULL`,
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
            absent: Math.max(0, totalEmps - present),
            onLeave: 0,
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
