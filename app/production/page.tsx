'use client';

/**
 * Page - Dashboard Production (Mobile-First)
 * Module Production & Usine
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Factory,
  Package,
  FileText,
  TrendingUp,
  AlertTriangle,
  Plus,
  PlayCircle,
  CheckCircle,
  Clock,
  Beaker,
  ChevronRight,
} from 'lucide-react';
import { ProductionOrder, Recipe } from '@/types/modules';
import { ProductionOrderCard } from '@/components/production/production-order-card';
import { RecipeCard } from '@/components/production/recipe-card';
import { Button } from '@/components/ui/button';

interface ProductionStatistics {
  totalOrders: number;
  ordersInProgress: number;
  ordersCompleted: number;
  totalProduced: number;
  activeRecipes: number;
  avgYieldRate: number;
}

export default function ProductionPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [statistics, setStatistics] = useState<ProductionStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'planned'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [ordersRes, recipesRes, statsRes] = await Promise.all([
        fetch('/api/production/orders'),
        fetch('/api/production/recipes?isActive=true'),
        fetch('/api/production/orders/statistics'),
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.data || []);
      }

      if (recipesRes.ok) {
        const recipesData = await recipesRes.json();
        setRecipes(recipesData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.data);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'in_progress') return order.Status === 'in_progress';
    if (filter === 'planned') return order.Status === 'planned';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <Factory className="w-7 h-7" />
            Production & Usine
          </h1>

          {/* KPIs */}
          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-5 h-5" />
                  <span className="text-sm opacity-90">Total Ordres</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalOrders}</p>
                <p className="text-xs opacity-80 mt-1">Tous statuts</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PlayCircle className="w-5 h-5" />
                  <span className="text-sm opacity-90">En Cours</span>
                </div>
                <p className="text-3xl font-bold">{statistics.ordersInProgress}</p>
                <p className="text-xs opacity-80 mt-1">Actifs</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm opacity-90">Terminés</span>
                </div>
                <p className="text-3xl font-bold">{statistics.ordersCompleted}</p>
                <p className="text-xs opacity-80 mt-1">Ce mois</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">Rendement Moy.</span>
                </div>
                <p className="text-3xl font-bold">{statistics.avgYieldRate}%</p>
                <p className="text-xs opacity-80 mt-1">Qualité</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Actions rapides */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Actions Rapides</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => router.push('/production/orders/new')}
              className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <Plus className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Nouvel Ordre</p>
              <p className="text-xs opacity-90 mt-1">Lancer production</p>
            </button>

            <button
              onClick={() => router.push('/production/recipes')}
              className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <FileText className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Recettes</p>
              <p className="text-xs opacity-90 mt-1">Gérer formules</p>
            </button>

            <button
              onClick={() => router.push('/production/ingredients')}
              className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <Beaker className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Ingrédients</p>
              <p className="text-xs opacity-90 mt-1">Stock matières</p>
            </button>
          </div>
        </div>

        {/* Ordres en cours/urgents */}
        {statistics && statistics.ordersInProgress > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Ordres en Production ({statistics.ordersInProgress})
              </h2>
              <button
                onClick={() => router.push('/production/orders?status=in_progress')}
                className="text-sm text-orange-600 font-medium flex items-center gap-1"
              >
                Tout voir
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {orders
                .filter((order) => order.Status === 'in_progress')
                .slice(0, 3)
                .map((order) => (
                  <ProductionOrderCard
                    key={order.ProductionOrderId}
                    order={order}
                    onClick={() =>
                      router.push(`/production/orders/${order.ProductionOrderId}`)
                    }
                    showDetails={true}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Recettes populaires */}
        {recipes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Recettes Actives ({recipes.length})</h2>
              <button
                onClick={() => router.push('/production/recipes')}
                className="text-sm text-purple-600 font-medium flex items-center gap-1"
              >
                Tout voir
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.slice(0, 3).map((recipe) => (
                <RecipeCard
                  key={recipe.RecipeId}
                  recipe={recipe}
                  onClick={() => router.push(`/production/recipes/${recipe.RecipeId}`)}
                  showDetails={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filtres ordres */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous les ordres
            </button>
            <button
              onClick={() => setFilter('planned')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === 'planned'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-1" />
              Planifiés
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === 'in_progress'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <PlayCircle className="w-4 h-4 inline mr-1" />
              En cours
            </button>
          </div>
        </div>

        {/* Compteur */}
        <div className="mb-4 px-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filteredOrders.length}</span>{' '}
            {filteredOrders.length > 1 ? 'ordres trouvés' : 'ordre trouvé'}
          </p>
        </div>

        {/* Liste ordres */}
        <div className="space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <ProductionOrderCard
                key={order.ProductionOrderId}
                order={order}
                onClick={() => router.push(`/production/orders/${order.ProductionOrderId}`)}
                showDetails={true}
              />
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Factory className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun ordre de production</p>
              <Button
                onClick={() => router.push('/production/orders/new')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Créer un ordre
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
