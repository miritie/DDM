/**
 * Dashboard Commercial / Vendeur
 * Vue optimisée pour les actions de vente rapides
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  DollarSign,
  Users,
  Target,
  TrendingUp,
  Award,
  Zap,
  Plus,
  Star,
  Phone,
  MessageSquare,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  ArrowRight,
  Gift,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/auth/logout-button';

interface SalesDashboardData {
  performance: {
    todaySales: number;
    weekSales: number;
    monthSales: number;
    objective: number;
    achievementRate: number;
    commission: number;
  };
  customers: {
    total: number;
    contactedToday: number;
    newThisWeek: number;
    topCustomers: Array<{
      name: string;
      totalSpent: number;
      lastPurchase: string;
    }>;
  };
  quickStats: {
    pendingSales: number;
    productsInCatalog: number;
    loyaltyPoints: number;
  };
  leaderboard?: {
    rank: number;
    totalSellers: number;
    topSeller: string;
  };
}

export default function SalesDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<SalesDashboardData | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/sales');
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-pink-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  const achievementRate = data?.performance.achievementRate || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 via-rose-600 to-red-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Commercial</h1>
            <p className="text-sm opacity-90">Performance & Ventes</p>
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

        {/* Objectif du mois */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium opacity-90">Objectif du mois</span>
            <span className="text-2xl font-bold">{achievementRate.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                achievementRate >= 100
                  ? 'bg-green-400'
                  : achievementRate >= 75
                  ? 'bg-yellow-400'
                  : 'bg-white'
              }`}
              style={{ width: `${Math.min(achievementRate, 100)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs opacity-75">
            <span>{data?.performance.monthSales.toLocaleString('fr-FR')} F</span>
            <span>{data?.performance.objective.toLocaleString('fr-FR')} F</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Classement */}
        {data?.leaderboard && (
          <Card className="border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Votre classement</p>
                    <p className="text-2xl font-bold text-gray-900">
                      #{data.leaderboard.rank} / {data.leaderboard.totalSellers}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600">Top vendeur</p>
                  <p className="font-bold text-yellow-700 flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-500" />
                    {data.leaderboard.topSeller}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance */}
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              Mes Ventes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Aujourd'hui</p>
                <p className="text-xl font-bold text-green-700">
                  {data?.performance.todaySales.toLocaleString('fr-FR')} F
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Cette semaine</p>
                <p className="text-xl font-bold text-green-600">
                  {data?.performance.weekSales.toLocaleString('fr-FR')} F
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Ce mois</p>
                <p className="text-xl font-bold text-green-600">
                  {data?.performance.monthSales.toLocaleString('fr-FR')} F
                </p>
              </div>
            </div>

            {/* Commission */}
            {data && data.performance.commission > 0 && (
              <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gift className="w-8 h-8 text-yellow-600" />
                    <div>
                      <p className="text-sm text-yellow-800 font-medium">Commission estimée</p>
                      <p className="text-2xl font-bold text-yellow-900">
                        {data.performance.commission.toLocaleString('fr-FR')} F
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Clients */}
        {data?.customers.topCustomers && data.customers.topCustomers.length > 0 && (
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Star className="w-6 h-6 text-blue-600" />
                Mes Meilleurs Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.customers.topCustomers.slice(0, 5).map((customer, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/customers/${customer.name}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        <p className="text-xs text-gray-600">
                          Dernier achat: {new Date(customer.lastPurchase).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">
                        {customer.totalSpent.toLocaleString('fr-FR')} F
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => router.push('/customers')}
                variant="outline"
                className="w-full mt-4 border-blue-600 text-blue-700 hover:bg-blue-50"
              >
                Voir tous mes clients <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Rapides */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-2 border-orange-200">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{data?.quickStats.pendingSales || 0}</p>
              <p className="text-xs text-gray-600 mt-1">Ventes en attente</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200">
            <CardContent className="p-4 text-center">
              <ShoppingCart className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{data?.quickStats.productsInCatalog || 0}</p>
              <p className="text-xs text-gray-600 mt-1">Produits dispo</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-indigo-200">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{data?.customers.total || 0}</p>
              <p className="text-xs text-gray-600 mt-1">Mes clients</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions Vente Rapide */}
        <Card className="border-2 border-pink-300 bg-gradient-to-br from-pink-100 to-rose-100">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-pink-800">
              <Zap className="w-6 h-6" />
              Actions Rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => router.push('/sales/quick')}
              className="w-full h-16 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold text-lg"
            >
              <Plus className="w-6 h-6 mr-2" />
              Nouvelle Vente Rapide
            </Button>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => router.push('/customers/quick')}
                className="h-14 bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-semibold"
              >
                <Users className="w-5 h-5 mr-2" />
                Nouveau Client
              </Button>

              <Button
                onClick={() => router.push('/customers')}
                className="h-14 bg-gradient-to-br from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white font-semibold"
              >
                <Phone className="w-5 h-5 mr-2" />
                Contacter Client
              </Button>

              <Button
                onClick={() => router.push('/sales')}
                className="h-14 bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Mes Ventes
              </Button>

              <Button
                onClick={() => router.push('/customers/loyalty')}
                className="h-14 bg-gradient-to-br from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-semibold"
              >
                <Gift className="w-5 h-5 mr-2" />
                Fidélité
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Conseils du jour */}
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-indigo-800">
              <MessageSquare className="w-5 h-5" />
              Conseil du Jour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white rounded-lg p-4 border-2 border-indigo-200">
              <p className="text-sm text-gray-800 leading-relaxed">
                💡 <strong>Astuce:</strong> Les clients qui achètent régulièrement méritent une attention
                particulière. Contactez vos top clients pour maintenir la relation et proposer des offres
                personnalisées!
              </p>
            </div>

            {data && data.customers.newThisWeek > 0 && (
              <div className="mt-3 p-3 bg-green-100 rounded-lg">
                <p className="text-sm font-semibold text-green-800">
                  ✨ {data.customers.newThisWeek} nouveaux clients cette semaine! Continuez comme ça!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
