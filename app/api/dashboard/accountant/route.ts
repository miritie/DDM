/**
 * API Route - Dashboard Comptable
 * GET /api/dashboard/accountant - Données pour le Dashboard Comptable
 *
 * Note sur le schéma :
 *   - wallets.type (pas wallet_type), wallets.is_active filtre les wallets clôturés
 *   - sales.amount_paid (pas paid_amount) ; sales.payment_status pour fully_paid/partially_paid
 *   - expenses.payment_date pour la date de décaissement effectif ;
 *     les demandes en attente vivent dans expense_requests (statut 'submitted'
 *     car l'enum n'a pas de valeur 'pending') car la ligne expenses n'est créée
 *     qu'à la validation.
 *   - employee_advances (pas salary_advances) — workspace_id via jointure employees.
 *
 * Robustesse : chaque requête est isolée dans son propre try/catch. Si une
 * seule échoue (table absente sur une instance, enum value obsolète, etc.)
 * la valeur tombe à 0 et le reste du dashboard continue de fonctionner.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPostgresClient } from '@/lib/database/postgres-client';
import { getCurrentWorkspaceId } from '@/lib/auth/get-session';
import { requirePermission, PERMISSIONS } from '@/lib/rbac/server';

// Exécute une requête, log l'erreur, et renvoie une valeur par défaut.
// Évite que UNE requête plantée ne ramène TOUT le dashboard à 0.
async function safeQuery<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    console.error(`[dashboard/accountant] ${label} a échoué :`, err?.message);
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.TREASURY_VIEW);
    const workspaceId = await getCurrentWorkspaceId();
    const db = getPostgresClient();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const salesStartDate =
      period === 'today' ? today :
      period === 'week'  ? weekStart :
                           monthStart;

    // ===== Trésorerie (wallets actifs uniquement) =====
    const treasury = await safeQuery(
      'wallets',
      async () => {
        const r = await db.query(
          `SELECT
             type::text AS type,
             COALESCE(SUM(balance), 0)::float AS balance
           FROM wallets
           WHERE workspace_id = $1 AND is_active = true
           GROUP BY type`,
          [workspaceId]
        );
        let cash = 0, bank = 0, mobile = 0;
        r.rows.forEach((row: any) => {
          const v = parseFloat(row.balance) || 0;
          if (row.type === 'cash') cash += v;
          else if (row.type === 'bank') bank += v;
          else if (row.type === 'mobile_money') mobile += v;
        });
        return { cashBalance: cash, bankBalance: bank, mobileMoneyBalance: mobile, totalBalance: cash + bank + mobile };
      },
      { cashBalance: 0, bankBalance: 0, mobileMoneyBalance: 0, totalBalance: 0 }
    );

    // ===== Dépenses effectivement payées (status='paid' ⇒ wallet débité) =====
    const expenseSql = (sinceDate: string | null) =>
      sinceDate
        ? `SELECT COALESCE(SUM(amount), 0)::float AS total
             FROM expenses
            WHERE workspace_id = $1
              AND status = 'paid'
              AND DATE(payment_date) >= $2`
        : `SELECT COALESCE(SUM(amount), 0)::float AS total
             FROM expenses
            WHERE workspace_id = $1
              AND status = 'paid'
              AND DATE(payment_date) = $2`;

    const expensesToday = await safeQuery('expenses-today',
      async () => (await db.query(expenseSql(null), [workspaceId, today])).rows[0]?.total ?? 0,
      0
    );
    const expensesWeek = await safeQuery('expenses-week',
      async () => (await db.query(expenseSql(weekStart), [workspaceId, weekStart])).rows[0]?.total ?? 0,
      0
    );
    const expensesMonth = await safeQuery('expenses-month',
      async () => (await db.query(expenseSql(monthStart), [workspaceId, monthStart])).rows[0]?.total ?? 0,
      0
    );

    // ===== Sollicitations en attente (expense_requests.status = 'submitted') =====
    // L'enum expense_request_status N'A PAS de valeur 'pending'.
    const pendingExpenseRequests = await safeQuery('pending-requests',
      async () => (await db.query(
        `SELECT COUNT(*)::int AS count
           FROM expense_requests
          WHERE workspace_id = $1 AND status = 'submitted'`,
        [workspaceId]
      )).rows[0]?.count ?? 0,
      0
    );

    // ===== Ventes & Encaissements =====
    const salesRevenue = await safeQuery('sales-revenue',
      async () => (await db.query(
        `SELECT COALESCE(SUM(total_amount), 0)::float AS total
           FROM sales
          WHERE workspace_id = $1 AND DATE(sale_date) >= $2`,
        [workspaceId, salesStartDate]
      )).rows[0]?.total ?? 0,
      0
    );
    const salesCollected = await safeQuery('sales-collected',
      async () => (await db.query(
        `SELECT COALESCE(SUM(amount_paid), 0)::float AS total
           FROM sales
          WHERE workspace_id = $1 AND DATE(sale_date) >= $2`,
        [workspaceId, salesStartDate]
      )).rows[0]?.total ?? 0,
      0
    );
    const salesReceivables = await safeQuery('sales-receivables',
      async () => (await db.query(
        `SELECT COALESCE(SUM(balance), 0)::float AS total
           FROM sales
          WHERE workspace_id = $1
            AND payment_status::text IN ('unpaid', 'partially_paid')
            AND status::text <> 'cancelled'`,
        [workspaceId]
      )).rows[0]?.total ?? 0,
      0
    );

    // ===== Masse salariale =====
    const totalEmployees = await safeQuery('employees-count',
      async () => (await db.query(
        `SELECT COUNT(*)::int AS count FROM employees WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId]
      )).rows[0]?.count ?? 0,
      0
    );
    const totalSalaries = await safeQuery('total-salaries',
      async () => (await db.query(
        `SELECT COALESCE(SUM(base_salary), 0)::float AS total FROM employees WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId]
      )).rows[0]?.total ?? 0,
      0
    );
    // Table = employee_advances (pas salary_advances) ; jointure employees pour workspace.
    const pendingAdvances = await safeQuery('pending-advances',
      async () => (await db.query(
        `SELECT COUNT(*)::int AS count
           FROM employee_advances ea
           JOIN employees e ON e.id = ea.employee_id
          WHERE e.workspace_id = $1 AND ea.status = 'pending'`,
        [workspaceId]
      )).rows[0]?.count ?? 0,
      0
    );

    // Prochaine paie : dernier jour du mois en cours
    const nextPayrollDate = new Date();
    nextPayrollDate.setMonth(nextPayrollDate.getMonth() + 1);
    nextPayrollDate.setDate(0);

    // ===== Alertes =====
    const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string; link?: string }> = [];
    if (treasury.totalBalance < 100000) {
      alerts.push({
        type: 'warning',
        message: 'Trésorerie faible. Surveiller les liquidités.',
        link: '/treasury',
      });
    }
    if (pendingExpenseRequests > 0) {
      alerts.push({
        type: 'info',
        message: `${pendingExpenseRequests} demande(s) de dépense en attente d'approbation`,
        link: '/depenses?filter=pending',
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          treasury,
          expenses: {
            today: expensesToday,
            week: expensesWeek,
            month: expensesMonth,
            pendingApproval: pendingExpenseRequests,
          },
          payroll: {
            totalEmployees,
            totalSalaries,
            pendingAdvances,
            nextPayrollDate: nextPayrollDate.toISOString(),
          },
          sales: {
            revenue: salesRevenue,
            collected: salesCollected,
            receivables: salesReceivables,
          },
          alerts,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[dashboard/accountant] Erreur globale :', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
