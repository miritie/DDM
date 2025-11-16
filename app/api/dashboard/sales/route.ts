/**
 * API Route - Dashboard Commercial
 * GET /api/dashboard/sales - Données pour le Dashboard Commercial
 */

import { NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { getCurrentWorkspaceId, getCurrentUserId } from '@/lib/auth/get-session';

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const userId = await getCurrentUserId();
    const db = getPostgresClient();

    // Dates pour les périodes
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Récupérer les employés pour trouver l'employee_id du user
    const employeeResult = await db.query(
      'SELECT employee_id, sales_objective FROM employees WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    const employee = employeeResult.rows[0];
    const salesObjective = employee?.sales_objective || 1000000;

    // Ventes (today, week, month)
    const [todaySales, weekSales, monthSales] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales
         WHERE workspace_id = $1 AND created_by = $2 AND DATE(created_at) = $3`,
        [workspaceId, userId, today]
      ),
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales
         WHERE workspace_id = $1 AND created_by = $2 AND DATE(created_at) >= $3`,
        [workspaceId, userId, weekAgo]
      ),
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales
         WHERE workspace_id = $1 AND created_by = $2 AND DATE(created_at) >= $3`,
        [workspaceId, userId, monthAgo]
      ),
    ]);

    const todayAmount = parseFloat(todaySales.rows[0].total) || 0;
    const weekAmount = parseFloat(weekSales.rows[0].total) || 0;
    const monthAmount = parseFloat(monthSales.rows[0].total) || 0;
    const achievementRate = (monthAmount / salesObjective) * 100;

    // Commission (exemple: 2% des ventes du mois)
    const commission = monthAmount * 0.02;

    // Top clients
    const topCustomersResult = await db.query(
      `SELECT
        c.full_name as name,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        MAX(s.created_at) as last_purchase
       FROM customers c
       LEFT JOIN sales s ON s.customer_id = c.customer_id AND s.workspace_id = c.workspace_id
       WHERE c.workspace_id = $1 AND s.created_by = $2
       GROUP BY c.customer_id, c.full_name
       ORDER BY total_spent DESC
       LIMIT 5`,
      [workspaceId, userId]
    );

    const topCustomers = topCustomersResult.rows.map(row => ({
      name: row.name,
      totalSpent: parseFloat(row.total_spent) || 0,
      lastPurchase: row.last_purchase || new Date().toISOString(),
    }));

    // Stats rapides
    const [pendingSalesResult, productsResult, customersResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as count
         FROM sales
         WHERE workspace_id = $1 AND created_by = $2 AND status IN ('draft', 'partially_paid')`,
        [workspaceId, userId]
      ),
      db.query(
        'SELECT COUNT(*) as count FROM products WHERE workspace_id = $1',
        [workspaceId]
      ),
      db.query(
        `SELECT COUNT(DISTINCT customer_id) as count
         FROM sales
         WHERE workspace_id = $1 AND created_by = $2`,
        [workspaceId, userId]
      ),
    ]);

    // Classement des vendeurs (optionnel)
    const leaderboardResult = await db.query(
      `WITH sales_by_seller AS (
        SELECT
          created_by,
          SUM(total_amount) as total_sales
        FROM sales
        WHERE workspace_id = $1 AND DATE(created_at) >= $2
        GROUP BY created_by
      ),
      ranked_sellers AS (
        SELECT
          created_by,
          total_sales,
          ROW_NUMBER() OVER (ORDER BY total_sales DESC) as rank
        FROM sales_by_seller
      )
      SELECT
        r.rank,
        (SELECT COUNT(*) FROM sales_by_seller) as total_sellers,
        (SELECT u.full_name FROM users u WHERE u.user_id = (SELECT created_by FROM ranked_sellers ORDER BY total_sales DESC LIMIT 1)) as top_seller
      FROM ranked_sellers r
      WHERE r.created_by = $3`,
      [workspaceId, monthAgo, userId]
    );

    const leaderboard = leaderboardResult.rows.length > 0 ? {
      rank: parseInt(leaderboardResult.rows[0].rank) || 1,
      totalSellers: parseInt(leaderboardResult.rows[0].total_sellers) || 1,
      topSeller: leaderboardResult.rows[0].top_seller || 'N/A',
    } : undefined;

    const data = {
      performance: {
        todaySales: todayAmount,
        weekSales: weekAmount,
        monthSales: monthAmount,
        objective: salesObjective,
        achievementRate: achievementRate,
        commission: commission,
      },
      customers: {
        total: parseInt(customersResult.rows[0].count) || 0,
        contactedToday: 0, // TODO: implémenter le tracking des contacts
        newThisWeek: 0, // TODO: calculer les nouveaux clients de la semaine
        topCustomers: topCustomers,
      },
      quickStats: {
        pendingSales: parseInt(pendingSalesResult.rows[0].count) || 0,
        productsInCatalog: parseInt(productsResult.rows[0].count) || 0,
        loyaltyPoints: 0, // TODO: récupérer les points fidélité si applicable
      },
      leaderboard: leaderboard,
    };

    return NextResponse.json(
      {
        success: true,
        data: data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching sales dashboard:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: {
          performance: {
            todaySales: 0,
            weekSales: 0,
            monthSales: 0,
            objective: 1000000,
            achievementRate: 0,
            commission: 0,
          },
          customers: {
            total: 0,
            contactedToday: 0,
            newThisWeek: 0,
            topCustomers: [],
          },
          quickStats: {
            pendingSales: 0,
            productsInCatalog: 0,
            loyaltyPoints: 0,
          },
        },
      },
      { status: 500 }
    );
  }
}
