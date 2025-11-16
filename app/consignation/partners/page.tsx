'use client';

/**
 * Page - Liste des Partenaires de Consignation (Mobile-First)
 * Gestion complète des partenaires avec filtres et actions rapides
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  Plus,
  Filter,
  TrendingUp,
  DollarSign,
  Users,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import { Partner, PartnerStatus, PartnerType } from '@/types/modules';
import { PartnerCard } from '@/components/consignation/partner-card';
import { Button } from '@/components/ui/button';

interface PartnerStatistics {
  totalPartners: number;
  activePartners: number;
  totalSales: number;
  totalOutstanding: number;
}

export default function PartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [statistics, setStatistics] = useState<PartnerStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    status?: PartnerStatus;
    type?: PartnerType;
    search?: string;
  }>({});

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [partners, filters]);

  async function loadPartners() {
    try {
      setLoading(true);
      const response = await fetch('/api/consignation/partners');
      const result = await response.json();

      if (response.ok) {
        setPartners(result.data || []);
        calculateStatistics(result.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement partenaires:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateStatistics(data: Partner[]) {
    setStatistics({
      totalPartners: data.length,
      activePartners: data.filter((p) => p.Status === 'active').length,
      totalSales: data.reduce((sum, p) => sum + p.TotalSold, 0),
      totalOutstanding: data.reduce((sum, p) => sum + p.CurrentBalance, 0),
    });
  }

  function applyFilters() {
    let filtered = [...partners];

    if (filters.status) {
      filtered = filtered.filter((p) => p.Status === filters.status);
    }

    if (filters.type) {
      filtered = filtered.filter((p) => p.Type === filters.type);
    }

    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.Name.toLowerCase().includes(query) ||
          p.PartnerCode.toLowerCase().includes(query) ||
          p.Phone.includes(query) ||
          p.ContactPerson.toLowerCase().includes(query) ||
          p.City?.toLowerCase().includes(query)
      );
    }

    setFilteredPartners(filtered);
  }

  function clearFilters() {
    setFilters({});
  }

  const hasActiveFilters = Object.keys(filters).some(
    (key) => filters[key as keyof typeof filters]
  );

  // Identifier les partenaires avec solde élevé
  const partnersWithHighBalance = filteredPartners.filter(
    (p) => p.CurrentBalance > 100000
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header avec statistiques */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="w-7 h-7" />
              Partenaires
            </h1>

            <Button
              onClick={() => router.push('/consignation/partners/new')}
              className="bg-white text-indigo-600 hover:bg-indigo-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouveau
            </Button>
          </div>

          {/* KPIs Cards */}
          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-5 h-5" />
                  <span className="text-sm opacity-90">Total</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalPartners}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Store className="w-5 h-5" />
                  <span className="text-sm opacity-90">Actifs</span>
                </div>
                <p className="text-3xl font-bold">{statistics.activePartners}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">Ventes Totales</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(statistics.totalSales)}{' '}
                  F
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-sm opacity-90">Soldes Dus</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(statistics.totalOutstanding)}{' '}
                  F
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
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
              className="w-full pl-12 pr-24 h-12 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-4 h-9 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                showFilters || hasActiveFilters
                  ? 'bg-indigo-600 text-white'
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                <div className="flex flex-wrap gap-2">
                  {(['active', 'inactive', 'suspended', 'pending'] as PartnerStatus[]).map(
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
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status === 'active' && 'Actif'}
                        {status === 'inactive' && 'Inactif'}
                        {status === 'suspended' && 'Suspendu'}
                        {status === 'pending' && 'En attente'}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="flex flex-wrap gap-2">
                  {(['pharmacy', 'relay_point', 'wholesaler', 'retailer', 'other'] as PartnerType[]).map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setFilters({
                            ...filters,
                            type: filters.type === type ? undefined : type,
                          })
                        }
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          filters.type === type
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {type === 'pharmacy' && '💊 Pharmacie'}
                        {type === 'relay_point' && '📍 Point Relais'}
                        {type === 'wholesaler' && '🏪 Grossiste'}
                        {type === 'retailer' && '🛒 Détaillant'}
                        {type === 'other' && '🏢 Autre'}
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

        {/* Alerte si soldes élevés */}
        {partnersWithHighBalance.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">Attention - Soldes élevés</h3>
              <p className="text-sm text-red-700 mt-1">
                {partnersWithHighBalance.length} partenaire{partnersWithHighBalance.length > 1 ? 's ont' : ' a'} un solde supérieur à 100 000 F. Règlement recommandé.
              </p>
            </div>
          </div>
        )}

        {/* Compteur */}
        <div className="mb-4 px-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filteredPartners.length}</span>{' '}
            {filteredPartners.length > 1 ? 'partenaires trouvés' : 'partenaire trouvé'}
          </p>
        </div>

        {/* Liste */}
        <div className="space-y-4">
          {filteredPartners.length > 0 ? (
            filteredPartners.map((partner) => (
              <PartnerCard
                key={partner.PartnerId}
                partner={partner}
                onClick={() => router.push(`/consignation/partners/${partner.PartnerId}`)}
                showDetails={true}
                showActions={true}
                onCall={() => (window.location.href = `tel:${partner.Phone}`)}
                onNewDeposit={() =>
                  router.push(`/consignation/deposits/new?partnerId=${partner.PartnerId}`)
                }
              />
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun partenaire trouvé</p>
              <Button
                onClick={() => router.push('/consignation/partners/new')}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Créer un partenaire
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
