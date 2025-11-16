'use client';

/**
 * Page - Clients & Fidélité (Mobile-First)
 * Liste complète optimisée pour utilisation mobile
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Filter,
  TrendingUp,
  Star,
  UserCheck,
  Crown,
  Search,
  X,
  Zap,
  Phone,
  QrCode,
} from 'lucide-react';
import { Customer, CustomerStatus, LoyaltyTier } from '@/types/modules';
import { CustomerCard } from '@/components/customers/customer-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CustomerStatistics {
  totalCustomers: number;
  activeCustomers: number;
  vipCustomers: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [statistics, setStatistics] = useState<CustomerStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    status?: CustomerStatus;
    tier?: LoyaltyTier;
    search?: string;
  }>({});

  useEffect(() => {
    loadCustomers();
    loadStatistics();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [customers, filters]);

  async function loadCustomers() {
    try {
      setLoading(true);
      const response = await fetch('/api/customers');
      const result = await response.json();

      if (response.ok) {
        setCustomers(result.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStatistics() {
    try {
      const response = await fetch('/api/customers/statistics');
      const result = await response.json();

      if (response.ok) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('Erreur chargement statistiques:', error);
    }
  }

  function applyFilters() {
    let filtered = [...customers];

    if (filters.status) {
      filtered = filtered.filter((c) => c.Status === filters.status);
    }

    if (filters.tier) {
      filtered = filtered.filter((c) => c.LoyaltyTier === filters.tier);
    }

    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.FullName.toLowerCase().includes(query) ||
          c.Phone.includes(query) ||
          c.Email?.toLowerCase().includes(query) ||
          c.CustomerCode.toLowerCase().includes(query)
      );
    }

    setFilteredCustomers(filtered);
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
      {/* Header avec statistiques */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-7 h-7" />
              Clients
            </h1>

            <Button
              onClick={() => router.push('/customers/new')}
              className="bg-white text-blue-600 hover:bg-blue-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
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
                <p className="text-3xl font-bold">{statistics.totalCustomers}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="w-5 h-5" />
                  <span className="text-sm opacity-90">Actifs</span>
                </div>
                <p className="text-3xl font-bold">{statistics.activeCustomers}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-5 h-5" />
                  <span className="text-sm opacity-90">VIP</span>
                </div>
                <p className="text-3xl font-bold">{statistics.vipCustomers}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">CA Total</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(statistics.totalRevenue)} F
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Ajout Client ULTRA-Rapide */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl p-6 mb-4 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
            <Zap className="w-6 h-6" />
            Ajout Client Ultra-Rapide
          </h2>
          <p className="text-sm opacity-90 mb-4">
            Capturez un client en moins de 5 secondes avec juste son numéro
          </p>
          <Button
            onClick={() => router.push('/customers/quick')}
            className="w-full bg-white text-red-600 hover:bg-red-50 h-14 text-lg font-bold rounded-xl shadow-lg"
          >
            <Phone className="w-6 h-6 mr-2" />
            Ajouter un Client
          </Button>
        </div>

        {/* QR Code Auto-Enregistrement */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-xl p-6 mb-4 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
            <QrCode className="w-6 h-6" />
            QR Code Auto-Enregistrement
          </h2>
          <p className="text-sm opacity-90 mb-4">
            Le client scanne et s'enregistre lui-même
          </p>
          <Button
            onClick={() => router.push('/customers/qr-register')}
            className="w-full bg-white text-purple-600 hover:bg-purple-50 h-14 text-lg font-bold rounded-xl shadow-lg"
          >
            <QrCode className="w-6 h-6 mr-2" />
            Afficher le QR Code
          </Button>
        </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                <div className="flex flex-wrap gap-2">
                  {(['active', 'inactive', 'vip', 'suspended'] as CustomerStatus[]).map((status) => (
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
                      {status === 'active' && 'Actif'}
                      {status === 'inactive' && 'Inactif'}
                      {status === 'vip' && 'VIP'}
                      {status === 'suspended' && 'Suspendu'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Niveau de fidélité
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as LoyaltyTier[]).map((tier) => (
                    <button
                      key={tier}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          tier: filters.tier === tier ? undefined : tier,
                        })
                      }
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filters.tier === tier
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </button>
                  ))}
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
            <span className="font-semibold text-gray-900">{filteredCustomers.length}</span>{' '}
            {filteredCustomers.length > 1 ? 'clients trouvés' : 'client trouvé'}
          </p>
        </div>

        {/* Liste */}
        <div className="space-y-4">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.CustomerId}
                customer={customer}
                onClick={() => router.push(`/customers/${customer.CustomerId}`)}
                showDetails={true}
                showActions={true}
                onCall={() => (window.location.href = `tel:${customer.Phone}`)}
                onNewSale={() => router.push(`/sales/new?customerId=${customer.CustomerId}`)}
              />
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun client trouvé</p>
              <Button
                onClick={() => router.push('/customers/new')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Créer un client
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
