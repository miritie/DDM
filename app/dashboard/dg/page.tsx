'use client';

/**
 * Page - Dashboard Direction Générale
 * Mobile-First - Vision temps réel de l'entreprise
 * KPIs, Graphiques, Alertes, Actions rapides
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Send,
  Calendar,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/logout-button';

interface DashboardKPI {
  label: string;
  value: number;
  trend: number;
  format: 'currency' | 'number' | 'percentage';
  icon: any;
  color: string;
}

interface DashboardData {
  lastUpdate: string;
  kpis: {
    revenue: DashboardKPI;
    expenses: DashboardKPI;
    profit: DashboardKPI;
    cashBalance: DashboardKPI;
    salesCount: DashboardKPI;
    customers: DashboardKPI;
  };
  alerts: Array<{
    type: 'success' | 'warning' | 'error';
    message: string;
  }>;
  topProducts: Array<{
    name: string;
    revenue: number;
    quantity: number;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    time: string;
    amount?: number;
  }>;
}

export default function DashboardDGPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Date range
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculer dates selon période
      const endDate = new Date().toISOString().split('T')[0];
      let startDate: string;

      if (period === 'today') {
        startDate = endDate;
      } else if (period === 'week') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        startDate = date.toISOString().split('T')[0];
      } else {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        startDate = date.toISOString().split('T')[0];
      }

      const response = await fetch(`/api/dashboard/dg?startDate=${startDate}&endDate=${endDate}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du chargement');
      }

      setData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const handleGeneratePointFlash = async () => {
    try {
      const response = await fetch('/api/reports/point-flash/generate', {
        method: 'POST',
      });

      const result = await response.json();

      if (response.ok) {
        alert('Point Flash généré et envoyé avec succès !');
      } else {
        alert(`Erreur: ${result.error}`);
      }
    } catch (error) {
      alert('Erreur lors de la génération du Point Flash');
    }
  };

  const formatValue = (kpi: DashboardKPI): string => {
    switch (kpi.format) {
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'XOF',
          minimumFractionDigits: 0,
        }).format(kpi.value);
      case 'percentage':
        return `${kpi.value.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('fr-FR').format(kpi.value);
    }
  };

  const formatTrend = (trend: number): { text: string; color: string; icon: any } => {
    if (trend > 0) {
      return {
        text: `+${trend.toFixed(1)}%`,
        color: 'text-green-600',
        icon: ArrowUpRight,
      };
    } else if (trend < 0) {
      return {
        text: `${trend.toFixed(1)}%`,
        color: 'text-red-600',
        icon: ArrowDownRight,
      };
    }
    return {
      text: '0%',
      color: 'text-gray-600',
      icon: null,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-800 text-center mb-2">Erreur</h2>
          <p className="text-red-700 text-center">{error}</p>
          <Button onClick={handleRefresh} className="w-full mt-4">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis = Object.values(data.kpis);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20">
      {/* Header Sticky */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold">Dashboard DG</h1>
            <p className="text-sm opacity-90">Vue d'ensemble temps réel</p>
          </div>
          <div className="flex items-center gap-2">
            <LogoutButton
              variant="ghost"
              size="sm"
              showText={false}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 text-white"
            />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
            >
              <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filtres période */}
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('today')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
              period === 'today'
                ? 'bg-white text-blue-600'
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
              period === 'week'
                ? 'bg-white text-blue-600'
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            7 jours
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold transition-all ${
              period === 'month'
                ? 'bg-white text-blue-600'
                : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            30 jours
          </button>
        </div>

        {/* Dernière MAJ */}
        <p className="text-xs opacity-75 mt-3 text-center">
          Dernière mise à jour: {new Date(data.lastUpdate).toLocaleString('fr-FR')}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Alertes */}
        {data.alerts && data.alerts.length > 0 && (
          <div className="space-y-2">
            {data.alerts.map((alert, idx) => {
              const config = {
                success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: '✅' },
                warning: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', icon: '⚠️' },
                error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: '🚨' },
              }[alert.type];

              return (
                <div
                  key={idx}
                  className={`${config.bg} border-2 ${config.border} rounded-xl p-3 flex items-start gap-3`}
                >
                  <span className="text-2xl flex-shrink-0">{config.icon}</span>
                  <p className={`text-sm font-medium ${config.text} flex-1`}>{alert.message}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            const trend = formatTrend(kpi.trend);
            const TrendIcon = trend.icon;

            return (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-md border-2 border-gray-100 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-8 h-8 ${kpi.color}`} />
                  {TrendIcon && (
                    <TrendIcon className={`w-5 h-5 ${trend.color}`} />
                  )}
                </div>

                <p className="text-xs text-gray-600 font-medium mb-1">{kpi.label}</p>
                <p className="text-xl font-bold text-gray-900 mb-1">{formatValue(kpi)}</p>

                <div className="flex items-center gap-1">
                  <span className={`text-xs font-semibold ${trend.color}`}>
                    {trend.text}
                  </span>
                  <span className="text-xs text-gray-500">vs précédent</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Produits */}
        {data.topProducts && data.topProducts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100 p-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Top Produits
            </h3>

            <div className="space-y-2">
              {data.topProducts.slice(0, 5).map((product, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{product.name}</p>
                      <p className="text-xs text-gray-600">{product.quantity} unités</p>
                    </div>
                  </div>

                  <p className="font-bold text-purple-600">
                    {new Intl.NumberFormat('fr-FR', {
                      minimumFractionDigits: 0,
                    }).format(product.revenue)} F
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activité Récente */}
        {data.recentActivity && data.recentActivity.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100 p-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              Activité Récente
            </h3>

            <div className="space-y-3">
              {data.recentActivity.slice(0, 5).map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="bg-blue-100 rounded-full w-2 h-2 mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                  {activity.amount && (
                    <p className="text-sm font-bold text-gray-900">
                      {new Intl.NumberFormat('fr-FR').format(activity.amount)} F
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions Rapides */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-xl p-6">
          <h3 className="font-bold text-white mb-4 text-lg">Actions Rapides</h3>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleGeneratePointFlash}
              className="h-16 bg-white/20 backdrop-blur-sm hover:bg-white/30 border-2 border-white/40 text-white font-bold"
            >
              <Send className="w-5 h-5 mr-2" />
              Point Flash
            </Button>

            <Button
              onClick={() => router.push('/reports')}
              className="h-16 bg-white/20 backdrop-blur-sm hover:bg-white/30 border-2 border-white/40 text-white font-bold"
            >
              <Download className="w-5 h-5 mr-2" />
              Rapports
            </Button>

            <Button
              onClick={() => router.push('/analytics')}
              className="h-16 bg-white/20 backdrop-blur-sm hover:bg-white/30 border-2 border-white/40 text-white font-bold"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              Analytics
            </Button>

            <Button
              onClick={() => router.push('/sales')}
              className="h-16 bg-white/20 backdrop-blur-sm hover:bg-white/30 border-2 border-white/40 text-white font-bold"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Ventes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
