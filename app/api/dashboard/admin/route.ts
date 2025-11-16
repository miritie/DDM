/**
 * API Route - Dashboard Admin
 * GET /api/dashboard/admin - Statistiques système pour administrateurs
 */

import { NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';

export async function GET() {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const db = getPostgresClient();

    // Récupérer les statistiques système en parallèle
    const [users, roles, permissions, sales, customers, products, employees] = await Promise.all([
      db.query('SELECT COUNT(*) as total, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active FROM users WHERE workspace_id = $1', [workspaceId]),
      db.query('SELECT COUNT(*) as total FROM roles WHERE workspace_id = $1', [workspaceId]),
      db.query('SELECT COUNT(*) as total FROM permissions'),
      db.query('SELECT COUNT(*) as total FROM sales WHERE workspace_id = $1', [workspaceId]),
      db.query('SELECT COUNT(*) as total FROM customers WHERE workspace_id = $1', [workspaceId]),
      db.query('SELECT COUNT(*) as total FROM products WHERE workspace_id = $1', [workspaceId]),
      db.query('SELECT COUNT(*) as total FROM employees WHERE workspace_id = $1', [workspaceId]),
    ]);

    const stats = {
      totalUsers: parseInt(users.rows[0].total) || 0,
      activeUsers: parseInt(users.rows[0].active) || 0,
      totalRoles: parseInt(roles.rows[0].total) || 0,
      totalPermissions: parseInt(permissions.rows[0].total) || 0,
      totalSales: parseInt(sales.rows[0].total) || 0,
      totalCustomers: parseInt(customers.rows[0].total) || 0,
      totalProducts: parseInt(products.rows[0].total) || 0,
      totalEmployees: parseInt(employees.rows[0].total) || 0,
    };

    return NextResponse.json(
      {
        success: true,
        data: stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: {
          totalUsers: 0,
          activeUsers: 0,
          totalRoles: 0,
          totalPermissions: 0,
          totalSales: 0,
          totalCustomers: 0,
          totalProducts: 0,
          totalEmployees: 0,
        },
      },
      { status: 500 }
    );
  }
}
