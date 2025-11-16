'use client';

/**
 * Page - Liste des Dépôts de Consignation (Mobile-First)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Filter,
  TrendingUp,
  DollarSign,
  Clock,
  Search,
  X,
} from 'lucide-react';
import { Deposit, DepositStatus } from '@/types/modules';
import { DepositCard } from '@/components/consignation/deposit-card';
import { Button } from '@/components/ui/button';

interface DepositStatistics {
  totalDeposits: number;
  activeDeposits: number;
  totalValue: number;
  totalSold: number;
}

export default function DepositsPage() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [filteredDeposits, setFilteredDeposits] = useState<Deposit[]>([]);
  const [statistics, setStatistics] = useState<DepositStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    status?: DepositStatus;
    search?: string;
  }>({});

  useEffect(() => {
    loadDeposits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [deposits, filters]);

  async function loadDeposits() {
    try {
      setLoading(true);
      const response = await fetch('/api/consignation/deposits');
      const result = await response.json();

      if (response.ok) {
        setDeposits(result.data || []);
        calculateStatistics(result.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement dépôts:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateStatistics(data: Deposit[]) {
    const activeDeposits = data.filter(
      (d) => d.Status === 'validated' || d.Status === 'partial'
    );

    const totalSold = data.reduce((sum, d) => {
      const sold = d.Lines.reduce((s, l) => s + l.QuantitySold * l.UnitPrice, 0);
      return sum + sold;
    }, 0);

    setStatistics({
      totalDeposits: data.length,
      activeDeposits: activeDeposits.length,
      totalValue: data.reduce((sum, d) => sum + d.TotalValue, 0),
      totalSold,
    });
  }

  function applyFilters() {
    let filtered = [...deposits];

    if (filters.status) {
      filtered = filtered.filter((d) => d.Status === filters.status);
    }

    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.DepositNumber.toLowerCase().includes(query) ||
          d.PartnerName.toLowerCase().includes(query)
      );
    }

    setFilteredDeposits(filtered);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-7 h-7" />
              Dépôts
            </h1>

            <Button
              onClick={() => router.push('/consignation/deposits/new')}
              className="bg-white text-blue-600 hover:bg-blue-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouveau
            </Button>
          </div>

          {/* KPIs */}
          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-5 h-5" />
                  <span className="text-sm opacity-90">Total</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalDeposits}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm opacity-90">Actifs</span>
                </div>
                <p className="text-3xl font-bold">{statistics.activeDeposits}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-sm opacity-90">Valeur Totale</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(statistics.totalValue)}{' '}
                  F
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">Vendu</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(statistics.totalSold)}{' '}
                  F
                </p>
              </div>
            </div>
          )}
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
              placeholder="Rechercher..."
              className="w-full pl-12 pr-24 h-12 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-4 h-9 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                showFilters || hasActiveFilters
                  ? 'bg-blue-600 text-white'
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
                  {(['pending', 'validated', 'partial', 'completed', 'cancelled'] as DepositStatus[]).map(
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
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status === 'pending' && 'En attente'}
                        {status === 'validated' && 'Validé'}
                        {status === 'partial' && 'Partiel'}
                        {status === 'completed' && 'Terminé'}
                        {status === 'cancelled' && 'Annulé'}
                      </button>
                    )
                  )}
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-2"
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
              {filteredDeposits.length}
            </span>{' '}
            {filteredDeposits.length > 1 ? 'dépôts trouvés' : 'dépôt trouvé'}
          </p>
        </div>

        {/* Liste */}
        <div className="space-y-4">
          {filteredDeposits.length > 0 ? (
            filteredDeposits.map((deposit) => (
              <DepositCard
                key={deposit.DepositId}
                deposit={deposit}
                onClick={() =>
                  router.push(`/consignation/deposits/${deposit.DepositId}`)
                }
                showDetails={true}
              />
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun dépôt trouvé</p>
              <Button
                onClick={() => router.push('/consignation/deposits/new')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Créer un dépôt
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
