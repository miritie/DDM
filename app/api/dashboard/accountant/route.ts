/**
 * API Route - Dashboard Comptable
 * GET /api/dashboard/accountant - Données pour le Dashboard Comptable
 *
 * Note sur le schéma :
 *   - wallets.type (pas wallet_type), wallets.is_active filtre les wallets clôturés
 *   - sales.amount_paid (pas paid_amount) ; sales.payment_status pour fully_paid/partially_paid
 *   - expenses.payment_date pour la date de décaissement effectif ;
 *     les demandes en attente vivent dans expense_requests (statut 'pending')
 *     car la ligne expenses n'est créée que quand la dépense est approuvée.
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

    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let salesStartDate: string;
    if (period === 'today') salesStartDate = today;
    else if (period === 'week') salesStartDate = weekStart;
    else salesStartDate = monthStart;

    // ===== Trésorerie (wallets actifs uniquement) =====
    const walletsResult = await db.query(
      `SELECT
         type,
         COALESCE(SUM(balance), 0)::float AS balance
       FROM wallets
       WHERE workspace_id = $1 AND is_active = true
       GROUP BY type`,
      [workspaceId]
    );

    let cashBalance = 0;
    let bankBalance = 0;
    let mobileMoneyBalance = 0;

    walletsResult.rows.forEach((row: any) => {
      const balance = parseFloat(row.balance) || 0;
      if (row.type === 'cash') cashBalance += balance;
      else if (row.type === 'bank') bankBalance += balance;
      else if (row.type === 'mobile_money') mobileMoneyBalance += balance;
    });

    const totalBalance = cashBalance + bankBalance + mobileMoneyBalance;

    // ===== Dépenses effectivement payées (status='paid' ⇒ wallet débité) =====
    // On somme amount sur la date de décaissement (payment_date) — pas
    // sur created_at, qui est la date d'enregistrement de la demande.
    const [todayExpenses, weekExpenses, monthExpenses] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
           FROM expenses
          WHERE workspace_id = $1
            AND status = 'paid'
            AND DATE(payment_date) = $2`,
        [workspaceId, today]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
           FROM expenses
          WHERE workspace_id = $1
            AND status = 'paid'
            AND DATE(payment_date) >= $2`,
        [workspaceId, weekStart]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
           FROM expenses
          WHERE workspace_id = $1
            AND status = 'paid'
            AND DATE(payment_date) >= $2`,
        [workspaceId, monthStart]
      ),
    ]);

    // ===== Sollicitations de dépense en attente (sur expense_requests) =====
    // Les pending vivent là, pas dans expenses (créé seulement après validation).
    const pendingRequests = await db.query(
      `SELECT COUNT(*)::int AS count
         FROM expense_requests
        WHERE workspace_id = $1
          AND status = 'pending'`,
      [workspaceId]
    );

    // ===== Ventes & Encaissements =====
    // CA = total facturé sur la période.
    // Encaissé = amount_paid effectivement reçu (somme), même partiel.
    // Créances = balance restant à percevoir sur les ventes non soldées.
    const [revenueResult, collectedResult, receivablesResult] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(total_amount), 0)::float AS total
           FROM sales
          WHERE workspace_id = $1
            AND DATE(sale_date) >= $2`,
        [workspaceId, salesStartDate]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount_paid), 0)::float AS total
           FROM sales
          WHERE workspace_id = $1
            AND DATE(sale_date) >= $2`,
        [workspaceId, salesStartDate]
      ),
      db.query(
        `SELECT COALESCE(SUM(balance), 0)::float AS total
           FROM sales
          WHERE workspace_id = $1
            AND payment_status IN ('unpaid', 'partially_paid')
            AND status <> 'cancelled'`,
        [workspaceId]
      ),
    ]);

    // ===== Masse salariale =====
    const [employeesCount, totalSalaries, pendingAdvances] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count FROM employees WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId]
      ),
      db.query(
        `SELECT COALESCE(SUM(base_salary), 0)::float AS total FROM employees WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId]
      ),
      db.query(
        `SELECT COUNT(*)::int AS count FROM salary_advances WHERE workspace_id = $1 AND status = 'pending'`,
        [workspaceId]
      ),
    ]);

    // Prochaine paie : dernier jour du mois en cours
    const nextPayrollDate = new Date();
    nextPayrollDate.setMonth(nextPayrollDate.getMonth() + 1);
    nextPayrollDate.setDate(0);

    // ===== Alertes =====
    const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string; link?: string }> = [];

    if (totalBalance < 100000) {
      alerts.push({
        type: 'warning',
        message: 'Trésorerie faible. Surveiller les liquidités.',
        link: '/treasury',
      });
    }

    const pendingExpensesCount = pendingRequests.rows[0].count || 0;
    if (pendingExpensesCount > 0) {
      alerts.push({
        type: 'info',
        message: `${pendingExpensesCount} demande(s) de dépense en attente d'approbation`,
        link: '/depenses?filter=pending',
      });
    }

    const data = {
      treasury: {
        totalBalance,
        cashBalance,
        bankBalance,
        mobileMoneyBalance,
      },
      expenses: {
        today: todayExpenses.rows[0].total || 0,
        week: weekExpenses.rows[0].total || 0,
        month: monthExpenses.rows[0].total || 0,
        pendingApproval: pendingExpensesCount,
      },
      payroll: {
        totalEmployees: employeesCount.rows[0].count || 0,
        totalSalaries: totalSalaries.rows[0].total || 0,
        pendingAdvances: pendingAdvances.rows[0].count || 0,
        nextPayrollDate: nextPayrollDate.toISOString(),
      },
      sales: {
        revenue: revenueResult.rows[0].total || 0,
        collected: collectedResult.rows[0].total || 0,
        receivables: receivablesResult.rows[0].total || 0,
      },
      alerts,
    };

    return NextResponse.json({ success: true, data }, { status: 200 });
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
