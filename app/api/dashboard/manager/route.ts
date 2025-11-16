/**
 * API Route - Dashboard Manager
 * GET /api/dashboard/manager - Données pour le Dashboard Manager
 */

import { NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const db = getPostgresClient();

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Ventes
    const [todaySales, weekSales, monthSales, pendingSales] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND DATE(created_at) = $2`,
        [workspaceId, today]
      ),
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
        [workspaceId, weekAgo]
      ),
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
        [workspaceId, monthAgo]
      ),
      db.query(
        `SELECT COUNT(*) as count
         FROM sales WHERE workspace_id = $1 AND status IN ('draft', 'partially_paid')`,
        [workspaceId]
      ),
    ]);

    // Stock
    const [lowStockResult, outOfStockResult, totalProductsResult, stockValueResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as count
         FROM products
         WHERE workspace_id = $1 AND stock_quantity <= stock_minimum AND stock_quantity > 0`,
        [workspaceId]
      ),
      db.query(
        `SELECT COUNT(*) as count
         FROM products WHERE workspace_id = $1 AND stock_quantity = 0`,
        [workspaceId]
      ),
      db.query(
        'SELECT COUNT(*) as count FROM products WHERE workspace_id = $1',
        [workspaceId]
      ),
      db.query(
        `SELECT COALESCE(SUM(stock_quantity * unit_price), 0) as total
         FROM products WHERE workspace_id = $1`,
        [workspaceId]
      ),
    ]);

    // Employés (présences aujourd'hui)
    const [totalEmployees, presentToday] = await Promise.all([
      db.query(
        'SELECT COUNT(*) as count FROM employees WHERE workspace_id = $1 AND is_active = true',
        [workspaceId]
      ),
      db.query(
        `SELECT COUNT(DISTINCT employee_id) as count
         FROM attendance
         WHERE workspace_id = $1 AND DATE(check_in) = $2`,
        [workspaceId, today]
      ),
    ]);

    const totalEmps = parseInt(totalEmployees.rows[0].count) || 0;
    const present = parseInt(presentToday.rows[0].count) || 0;

    // Clients
    const [totalCustomers, newCustomers, activeCustomers] = await Promise.all([
      db.query(
        'SELECT COUNT(*) as count FROM customers WHERE workspace_id = $1',
        [workspaceId]
      ),
      db.query(
        `SELECT COUNT(*) as count
         FROM customers WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
        [workspaceId, weekAgo]
      ),
      db.query(
        `SELECT COUNT(DISTINCT customer_id) as count
         FROM sales WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
        [workspaceId, monthAgo]
      ),
    ]);

    // Alertes intelligentes
    const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string; action?: string; link?: string }> = [];

    const outOfStock = parseInt(outOfStockResult.rows[0].count) || 0;
    const lowStock = parseInt(lowStockResult.rows[0].count) || 0;

    if (outOfStock > 0) {
      alerts.push({
        type: 'error',
        message: `${outOfStock} produit(s) en rupture de stock !`,
        action: 'Voir les produits',
        link: '/stock?filter=out_of_stock',
      });
    }

    if (lowStock > 0) {
      alerts.push({
        type: 'warning',
        message: `${lowStock} produit(s) avec stock faible`,
        action: 'Voir les alertes',
        link: '/stock/alerts',
      });
    }

    const pending = parseInt(pendingSales.rows[0].count) || 0;
    if (pending > 5) {
      alerts.push({
        type: 'info',
        message: `${pending} ventes en attente de paiement`,
        action: 'Voir les ventes',
        link: '/sales?filter=pending',
      });
    }

    const data = {
      sales: {
        today: parseFloat(todaySales.rows[0].total) || 0,
        week: parseFloat(weekSales.rows[0].total) || 0,
        month: parseFloat(monthSales.rows[0].total) || 0,
        pending: pending,
      },
      stock: {
        lowStock: lowStock,
        outOfStock: outOfStock,
        totalProducts: parseInt(totalProductsResult.rows[0].count) || 0,
        totalValue: parseFloat(stockValueResult.rows[0].total) || 0,
      },
      employees: {
        total: totalEmps,
        present: present,
        absent: totalEmps - present,
        onLeave: 0, // TODO: calculer les congés en cours
      },
      customers: {
        total: parseInt(totalCustomers.rows[0].count) || 0,
        new: parseInt(newCustomers.rows[0].count) || 0,
        active: parseInt(activeCustomers.rows[0].count) || 0,
      },
      alerts: alerts,
    };

    return NextResponse.json(
      {
        success: true,
        data: data,
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
