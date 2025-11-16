/**
 * API Route - Dashboard DG
 * GET /api/dashboard/dg - Données temps réel pour le Dashboard Direction Générale
 */

import { NextRequest, NextResponse } from 'next/server';
import { DashboardService } from '@/lib/modules/reports/dashboard-service';

const dashboardService = new DashboardService();

export async function GET(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    // Récupérer le dashboard global
    const dashboard = await dashboardService.getGlobalDashboard(workspaceId, startDate, endDate);

    // Générer alertes automatiques
    const alerts: Array<{ type: 'success' | 'warning' | 'error'; message: string }> = [];

    if (dashboard.kpis.profit.changePercent < -20) {
      alerts.push({
        type: 'error',
        message: `Bénéfice en forte baisse: ${dashboard.kpis.profit.changePercent.toFixed(1)}%`,
      });
    }

    if (dashboard.kpis.cashBalance.value < 0) {
      alerts.push({
        type: 'error',
        message: 'Trésorerie négative ! Actions urgentes requises',
      });
    }

    if (dashboard.kpis.revenue.changePercent > 20) {
      alerts.push({
        type: 'success',
        message: `Excellente performance ! CA +${dashboard.kpis.revenue.changePercent.toFixed(1)}%`,
      });
    }

    // Top produits (depuis charts)
    const topProducts = dashboard.charts.topProducts.labels.slice(0, 5).map((name, idx) => ({
      name,
      revenue: dashboard.charts.topProducts.datasets[0].data[idx],
      quantity: 0, // TODO: récupérer quantités
    }));

    // Activité récente (simulée pour l'instant - TODO: récupérer vraies données)
    const recentActivity = [
      {
        type: 'sale',
        description: 'Nouvelle vente enregistrée',
        time: 'Il y a 5 minutes',
        amount: 45000,
      },
      {
        type: 'expense',
        description: 'Dépense approuvée: Fournitures bureau',
        time: 'Il y a 23 minutes',
        amount: 12000,
      },
      {
        type: 'customer',
        description: 'Nouveau client ajouté',
        time: 'Il y a 1 heure',
      },
    ];

    // Formater les KPIs pour le dashboard DG
    const response = {
      lastUpdate: new Date().toISOString(),
      kpis: {
        revenue: {
          ...dashboard.kpis.revenue,
          icon: 'DollarSign',
          color: 'text-green-600',
        },
        expenses: {
          ...dashboard.kpis.expenses,
          icon: 'TrendingDown',
          color: 'text-red-600',
        },
        profit: {
          ...dashboard.kpis.profit,
          icon: 'TrendingUp',
          color: 'text-blue-600',
        },
        cashBalance: {
          ...dashboard.kpis.cashBalance,
          icon: 'DollarSign',
          color: 'text-purple-600',
        },
        salesCount: {
          ...dashboard.kpis.sales,
          icon: 'ShoppingCart',
          color: 'text-orange-600',
        },
        customers: {
          ...dashboard.kpis.customers,
          icon: 'Users',
          color: 'text-indigo-600',
        },
      },
      alerts,
      topProducts,
      recentActivity,
    };

    return NextResponse.json(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur Dashboard DG:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
