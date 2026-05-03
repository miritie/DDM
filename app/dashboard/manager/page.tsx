'use client';

/**
 * Dashboard Manager
 * Vue opérationnelle: ventes, stock, employés, clients
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  UserCheck,
  Loader2,
  RefreshCw,
  Plus,
  ArrowRight,
  MapPin,
  Calendar,
  PowerSquare,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/logout-button';

interface ManagerDashboardData {
  sales: {
    today: number;
    week: number;
    month: number;
    pending: number;
  };
  stock: {
    lowStock: number;
    outOfStock: number;
    totalProducts: number;
    totalValue: number;
  };
  employees: {
    total: number;
    present: number;
    absent: number;
    onLeave: number;
  };
  customers: {
    total: number;
    new: number;
    active: number;
  };
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    action?: string;
    link?: string;
  }>;
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ManagerDashboardData | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/manager');
      const result = await response.json();

      if (response.ok) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Manager</h1>
            <p className="text-sm opacity-90">Opérations & Supervision</p>
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
      </div>

      <div className="p-6 space-y-6">
        {/* Alertes */}
        {data?.alerts && data.alerts.length > 0 && (
          <div className="space-y-2">
            {data.alerts.map((alert, idx) => (
              <Card
                key={idx}
                className={`border-2 ${
                  alert.type === 'error'
                    ? 'border-red-200 bg-red-50'
                    : alert.type === 'warning'
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      alert.type === 'error'
                        ? 'text-red-600'
                        : alert.type === 'warning'
                        ? 'text-orange-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{alert.message}</p>
                    {alert.action && alert.link && (
                      <button
                        onClick={() => alert.link && router.push(alert.link)}
                        className="text-xs font-semibold mt-2 flex items-center gap-1 hover:underline"
                      >
                        {alert.action} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Ventes du Jour */}
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                Ventes
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Aujourd'hui</p>
                <p className="text-2xl font-bold text-green-700">
                  {data?.sales.today.toLocaleString('fr-FR')} F
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Cette semaine</p>
                <p className="text-xl font-bold text-green-600">
                  {data?.sales.week.toLocaleString('fr-FR')} F
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Ce mois</p>
                <p className="text-xl font-bold text-green-600">
                  {data?.sales.month.toLocaleString('fr-FR')} F
                </p>
              </div>
            </div>
            {data && data.sales.pending > 0 && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-sm text-orange-700 font-medium">
                  ⚠️ {data.sales.pending} ventes en attente de paiement
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-6 h-6 text-purple-600" />
              État des Stocks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 font-medium mb-1">Total produits</p>
                <p className="text-2xl font-bold text-purple-700">{data?.stock.totalProducts || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs text-gray-600 font-medium mb-1">Valeur stock</p>
                <p className="text-lg font-bold text-purple-600">
                  {data?.stock.totalValue.toLocaleString('fr-FR')} F
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {data && data.stock.outOfStock > 0 && (
                <div className="flex items-center justify-between p-2 bg-red-100 rounded-lg">
                  <span className="text-sm font-medium text-red-800">Rupture de stock</span>
                  <span className="px-2 py-1 rounded-full bg-red-600 text-white text-xs font-bold">
                    {data.stock.outOfStock}
                  </span>
                </div>
              )}
              {data && data.stock.lowStock > 0 && (
                <div className="flex items-center justify-between p-2 bg-orange-100 rounded-lg">
                  <span className="text-sm font-medium text-orange-800">Stock faible</span>
                  <span className="px-2 py-1 rounded-full bg-orange-600 text-white text-xs font-bold">
                    {data.stock.lowStock}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={() => router.push('/stock')}
              className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
            >
              Gérer les stocks <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Employés */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Équipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-700">{data?.employees.total || 0}</p>
                <p className="text-xs text-gray-600 mt-1">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{data?.employees.present || 0}</p>
                <p className="text-xs text-gray-600 mt-1">Présents</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{data?.employees.absent || 0}</p>
                <p className="text-xs text-gray-600 mt-1">Absents</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{data?.employees.onLeave || 0}</p>
                <p className="text-xs text-gray-600 mt-1">Congés</p>
              </div>
            </div>

            <Button
              onClick={() => router.push('/hr/attendance')}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Voir les présences <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Clients */}
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-indigo-600" />
              Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-700">{data?.customers.total || 0}</p>
                <p className="text-xs text-gray-600 mt-1">Total</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{data?.customers.new || 0}</p>
                <p className="text-xs text-gray-600 mt-1">Nouveaux</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{data?.customers.active || 0}</p>
                <p className="text-xs text-gray-600 mt-1">Actifs</p>
              </div>
            </div>

            <Button
              onClick={() => router.push('/customers')}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700"
            >
              Gérer les clients <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Bloc Commandes clients */}
        <Card className="border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-cyan-600" />
              Commandes clients négociées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              Saisissez les commandes clients négociées (multi-produits, prix négociés, avance).
              Elles déclenchent — après validation admin — une production et un transfert vers l'entrepôt destination.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => router.push('/orders/new')}
                className="h-16 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold">
                <Plus className="w-5 h-5 mr-1" /> Nouvelle commande
              </Button>
              <Button onClick={() => router.push('/orders')} variant="outline"
                className="h-16 border-2 border-cyan-300 font-semibold">
                <ClipboardList className="w-5 h-5 mr-1" /> Toutes les commandes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bloc Points de vente — accès direct manager commercial */}
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-6 h-6 text-amber-600" />
              Points de vente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Button onClick={() => router.push('/admin/outlets')}
                className="h-20 bg-white hover:bg-amber-100 text-amber-800 border-2 border-amber-200 flex flex-col items-center justify-center gap-1">
                <MapPin className="w-5 h-5" />
                <span className="text-sm font-semibold">Liste outlets</span>
              </Button>
              <Button onClick={() => router.push('/admin/outlets/planning')}
                className="h-20 bg-white hover:bg-amber-100 text-amber-800 border-2 border-amber-200 flex flex-col items-center justify-center gap-1">
                <Calendar className="w-5 h-5" />
                <span className="text-sm font-semibold">Planning commerciaux</span>
              </Button>
              <Button onClick={() => router.push('/admin/outlets/activation')}
                className="h-20 bg-white hover:bg-amber-100 text-amber-800 border-2 border-amber-200 flex flex-col items-center justify-center gap-1">
                <PowerSquare className="w-5 h-5" />
                <span className="text-sm font-semibold">Activation mensuelle</span>
              </Button>
              <Button onClick={() => router.push('/admin/outlets/reporting')}
                className="h-20 bg-white hover:bg-amber-100 text-amber-800 border-2 border-amber-200 flex flex-col items-center justify-center gap-1">
                <BarChart3 className="w-5 h-5" />
                <span className="text-sm font-semibold">Reporting</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions Rapides */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => router.push('/sales/quick')}
            className="h-20 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold flex flex-col items-center justify-center gap-2"
          >
            <Plus className="w-6 h-6" />
            <span>Nouvelle Vente</span>
          </Button>

          <Button
            onClick={() => router.push('/stock/movements/quick')}
            className="h-20 bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-bold flex flex-col items-center justify-center gap-2"
          >
            <Package className="w-6 h-6" />
            <span>Mouvement Stock</span>
          </Button>

          <Button
            onClick={() => router.push('/customers/quick')}
            className="h-20 bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold flex flex-col items-center justify-center gap-2"
          >
            <UserCheck className="w-6 h-6" />
            <span>Nouveau Client</span>
          </Button>

          <Button
            onClick={() => router.push('/reports')}
            className="h-20 bg-gradient-to-br from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold flex flex-col items-center justify-center gap-2"
          >
            <TrendingUp className="w-6 h-6" />
            <span>Rapports</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
