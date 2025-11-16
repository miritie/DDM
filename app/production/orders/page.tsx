'use client';

/**
 * Page - Liste des Ordres de Production (Mobile-First)
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Factory,
  Plus,
  Filter,
  X,
  Search,
  Clock,
  PlayCircle,
  CheckCircle,
} from 'lucide-react';
import { ProductionOrder, ProductionOrderStatus } from '@/types/modules';
import { ProductionOrderCard } from '@/components/production/production-order-card';
import { Button } from '@/components/ui/button';

export default function ProductionOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    status?: ProductionOrderStatus;
    priority?: string;
    search?: string;
  }>({});

  useEffect(() => {
    loadOrders();

    // Check for status param
    const status = searchParams?.get('status');
    if (status) {
      setFilters({ status: status as ProductionOrderStatus });
    }
  }, [searchParams]);

  useEffect(() => {
    applyFilters();
  }, [orders, filters]);

  async function loadOrders() {
    try {
      setLoading(true);
      const response = await fetch('/api/production/orders');
      const result = await response.json();

      if (response.ok) {
        setOrders(result.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement ordres:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...orders];

    if (filters.status) {
      filtered = filtered.filter((o) => o.Status === filters.status);
    }

    if (filters.priority) {
      filtered = filtered.filter((o) => o.Priority === filters.priority);
    }

    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.OrderNumber.toLowerCase().includes(query) ||
          o.ProductName?.toLowerCase().includes(query) ||
          o.RecipeName?.toLowerCase().includes(query)
      );
    }

    setFilteredOrders(filtered);
  }

  function clearFilters() {
    setFilters({});
  }

  const hasActiveFilters = Object.keys(filters).some(
    (key) => filters[key as keyof typeof filters]
  );

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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Factory className="w-7 h-7" />
              Ordres de Production
            </h1>

            <Button
              onClick={() => router.push('/production/orders/new')}
              className="bg-white text-orange-600 hover:bg-orange-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouveau
            </Button>
          </div>

          {/* KPIs rapides */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <Clock className="w-5 h-5 mx-auto mb-1" />
              <p className="text-2xl font-bold">
                {orders.filter((o) => o.Status === 'planned').length}
              </p>
              <p className="text-xs opacity-80 mt-1">Planifiés</p>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <PlayCircle className="w-5 h-5 mx-auto mb-1" />
              <p className="text-2xl font-bold">
                {orders.filter((o) => o.Status === 'in_progress').length}
              </p>
              <p className="text-xs opacity-80 mt-1">En cours</p>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
              <CheckCircle className="w-5 h-5 mx-auto mb-1" />
              <p className="text-2xl font-bold">
                {orders.filter((o) => o.Status === 'completed').length}
              </p>
              <p className="text-xs opacity-80 mt-1">Terminés</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Barre de recherche et filtres */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Rechercher un ordre..."
              className="w-full pl-12 pr-24 h-12 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-4 h-9 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                showFilters || hasActiveFilters
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtres
            </button>
          </div>

          {/* Filtres dépliables */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['draft', 'planned', 'in_progress', 'completed', 'cancelled'] as ProductionOrderStatus[]).map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() =>
                          setFilters({
                            ...filters,
                            status: filters.status === status ? undefined : status,
                          })
                        }
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          filters.status === status
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status === 'draft' && 'Brouillon'}
                        {status === 'planned' && 'Planifié'}
                        {status === 'in_progress' && 'En cours'}
                        {status === 'completed' && 'Terminé'}
                        {status === 'cancelled' && 'Annulé'}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priorité
                </label>
                <div className="flex flex-wrap gap-2">
                  {['low', 'normal', 'high', 'urgent'].map((priority) => (
                    <button
                      key={priority}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          priority: filters.priority === priority ? undefined : priority,
                        })
                      }
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filters.priority === priority
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {priority === 'low' && 'Basse'}
                      {priority === 'normal' && 'Normale'}
                      {priority === 'high' && 'Haute'}
                      {priority === 'urgent' && 'Urgente'}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Effacer les filtres
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compteur */}
        <div className="mb-4 px-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {filteredOrders.length}
            </span>{' '}
            {filteredOrders.length > 1 ? 'ordres trouvés' : 'ordre trouvé'}
          </p>
        </div>

        {/* Liste */}
        <div className="space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <ProductionOrderCard
                key={order.ProductionOrderId}
                order={order}
                onClick={() =>
                  router.push(`/production/orders/${order.ProductionOrderId}`)
                }
                showDetails={true}
              />
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Factory className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun ordre trouvé</p>
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
