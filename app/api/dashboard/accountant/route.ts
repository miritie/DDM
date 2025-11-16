/**
 * API Route - Dashboard Comptable
 * GET /api/dashboard/accountant - Données pour le Dashboard Comptable
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getCurrentWorkspaceId();
    const db = getPostgresClient();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    // Calculer les dates selon la période
    const today = new Date().toISOString().split('T')[0];
    let startDate: string;

    if (period === 'today') {
      startDate = today;
    } else if (period === 'week') {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    // Trésorerie (wallets)
    const walletsResult = await db.query(
      `SELECT
        wallet_type,
        COALESCE(SUM(balance), 0) as balance
       FROM wallets
       WHERE workspace_id = $1
       GROUP BY wallet_type`,
      [workspaceId]
    );

    let cashBalance = 0;
    let bankBalance = 0;
    let mobileMoneyBalance = 0;

    walletsResult.rows.forEach(row => {
      const balance = parseFloat(row.balance) || 0;
      if (row.wallet_type === 'cash') cashBalance += balance;
      else if (row.wallet_type === 'bank') bankBalance += balance;
      else if (row.wallet_type === 'mobile_money') mobileMoneyBalance += balance;
    });

    const totalBalance = cashBalance + bankBalance + mobileMoneyBalance;

    // Dépenses
    const [todayExpenses, weekExpenses, monthExpenses, pendingExpenses] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM expenses WHERE workspace_id = $1 AND DATE(expense_date) = $2`,
        [workspaceId, today]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM expenses WHERE workspace_id = $1 AND DATE(expense_date) >= $2`,
        [workspaceId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM expenses WHERE workspace_id = $1 AND DATE(expense_date) >= $2`,
        [workspaceId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
      ),
      db.query(
        `SELECT COUNT(*) as count
         FROM expenses WHERE workspace_id = $1 AND status = 'pending'`,
        [workspaceId]
      ),
    ]);

    // Ventes & Encaissements
    const [revenueResult, collectedResult, receivablesResult] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND DATE(created_at) >= $2`,
        [workspaceId, startDate]
      ),
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND status = 'fully_paid' AND DATE(created_at) >= $2`,
        [workspaceId, startDate]
      ),
      db.query(
        `SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total
         FROM sales WHERE workspace_id = $1 AND status IN ('partially_paid', 'confirmed')`,
        [workspaceId]
      ),
    ]);

    // Masse salariale
    const [employeesCount, totalSalaries, pendingAdvances] = await Promise.all([
      db.query(
        'SELECT COUNT(*) as count FROM employees WHERE workspace_id = $1 AND is_active = true',
        [workspaceId]
      ),
      db.query(
        'SELECT COALESCE(SUM(base_salary), 0) as total FROM employees WHERE workspace_id = $1 AND is_active = true',
        [workspaceId]
      ),
      db.query(
        `SELECT COUNT(*) as count FROM salary_advances WHERE workspace_id = $1 AND status = 'pending'`,
        [workspaceId]
      ),
    ]);

    // Prochaine date de paie (exemple: fin du mois)
    const nextPayrollDate = new Date();
    nextPayrollDate.setMonth(nextPayrollDate.getMonth() + 1);
    nextPayrollDate.setDate(0); // Dernier jour du mois en cours

    // Alertes
    const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string; link?: string }> = [];

    if (totalBalance < 100000) {
      alerts.push({
        type: 'warning',
        message: 'Trésorerie faible. Surveiller les liquidités.',
        link: '/treasury',
      });
    }

    const pendingExpensesCount = parseInt(pendingExpenses.rows[0].count) || 0;
    if (pendingExpensesCount > 0) {
      alerts.push({
        type: 'info',
        message: `${pendingExpensesCount} demande(s) de dépense en attente d'approbation`,
        link: '/depenses?filter=pending',
      });
    }

    const data = {
      treasury: {
        totalBalance: totalBalance,
        cashBalance: cashBalance,
        bankBalance: bankBalance,
        mobileMoneyBalance: mobileMoneyBalance,
      },
      expenses: {
        today: parseFloat(todayExpenses.rows[0].total) || 0,
        week: parseFloat(weekExpenses.rows[0].total) || 0,
        month: parseFloat(monthExpenses.rows[0].total) || 0,
        pendingApproval: pendingExpensesCount,
      },
      payroll: {
        totalEmployees: parseInt(employeesCount.rows[0].count) || 0,
        totalSalaries: parseFloat(totalSalaries.rows[0].total) || 0,
        pendingAdvances: parseInt(pendingAdvances.rows[0].count) || 0,
        nextPayrollDate: nextPayrollDate.toISOString(),
      },
      sales: {
        revenue: parseFloat(revenueResult.rows[0].total) || 0,
        receivables: parseFloat(receivablesResult.rows[0].total) || 0,
        collected: parseFloat(collectedResult.rows[0].total) || 0,
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
    console.error('Error fetching accountant dashboard:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
