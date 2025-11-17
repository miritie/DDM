'use client';

/**
 * Page - Liste Complète des Demandes de Dépenses (Mobile-First)
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DollarSign,
  Filter,
  X,
  Search,
  FileText,
  Plus,
  Zap,
} from 'lucide-react';
import { ExpenseRequest, ExpenseRequestStatus, ExpenseUrgency } from '@/types/modules';
import { ExpenseRequestCard } from '@/components/expenses/expense-request-card';
import { Button } from '@/components/ui/button';

export default function ExpenseRequestsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<{
    search?: string;
    status?: ExpenseRequestStatus[];
    urgency?: ExpenseUrgency[];
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  }>({});

  // Initialiser filtres depuis URL
  useEffect(() => {
    const urlFilters: typeof filters = {};

    const status = searchParams.get('status');
    if (status) {
      urlFilters.status = [status as ExpenseRequestStatus];
    }

    setFilters(urlFilters);
  }, [searchParams]);

  useEffect(() => {
    loadRequests();
  }, [searchParams]);

  useEffect(() => {
    applyFilters();
  }, [requests, filters]);

  async function loadRequests() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      // Paramètres URL
      const my = searchParams.get('my');
      const needsMyApproval = searchParams.get('needsMyApproval');

      if (my === 'true') params.append('my', 'true');
      if (needsMyApproval === 'true') params.append('needsMyApproval', 'true');

      const response = await fetch(`/api/expenses/requests?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...requests];

    // Recherche textuelle
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.RequestNumber.toLowerCase().includes(query) ||
          r.Title.toLowerCase().includes(query) ||
          r.RequesterName.toLowerCase().includes(query) ||
          r.Description?.toLowerCase().includes(query)
      );
    }

    // Statut
    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter((r) => filters.status!.includes(r.Status));
    }

    // Urgence
    if (filters.urgency && filters.urgency.length > 0) {
      filtered = filtered.filter((r) => filters.urgency!.includes(r.Urgency));
    }

    // Catégorie
    if (filters.category) {
      filtered = filtered.filter((r) => (r.Category as any) === filters.category);
    }

    // Date range
    if (filters.dateFrom) {
      filtered = filtered.filter(
        (r) => new Date(r.RequestDate) >= new Date(filters.dateFrom!)
      );
    }
    if (filters.dateTo) {
      filtered = filtered.filter(
        (r) => new Date(r.RequestDate) <= new Date(filters.dateTo!)
      );
    }

    setFilteredRequests(filtered);
  }

  function toggleStatus(status: ExpenseRequestStatus) {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setFilters({ ...filters, status: updated.length > 0 ? updated : undefined });
  }

  function toggleUrgency(urgency: ExpenseUrgency) {
    const current = filters.urgency || [];
    const updated = current.includes(urgency)
      ? current.filter((u) => u !== urgency)
      : [...current, urgency];
    setFilters({ ...filters, urgency: updated.length > 0 ? updated : undefined });
  }

  function clearFilters() {
    setFilters({});
  }

  const hasActiveFilters = Object.keys(filters).some(
    (key) => filters[key as keyof typeof filters] !== undefined
  );

  const my = searchParams.get('my') === 'true';
  const needsMyApproval = searchParams.get('needsMyApproval') === 'true';

  const pageTitle = needsMyApproval
    ? 'À Valider'
    : my
    ? 'Mes Demandes'
    : 'Toutes les Demandes';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-7 h-7" />
                {pageTitle}
              </h1>
              <p className="text-sm opacity-90 mt-1">
                {filteredRequests.length}{' '}
                {filteredRequests.length > 1 ? 'demandes' : 'demande'}
              </p>
            </div>

            <Button
              onClick={() => router.push('/expenses/requests/quick')}
              className="bg-white text-red-600 hover:bg-red-50 h-12 px-5 rounded-xl font-semibold shadow-lg"
            >
              <Zap className="w-5 h-5 mr-2" />
              Rapide
            </Button>
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
              placeholder="Rechercher (n°, titre, demandeur)..."
              className="w-full pl-12 pr-24 h-12 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-red-500"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-4 h-9 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                showFilters || hasActiveFilters
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="bg-white text-red-600 rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">
                  {Object.keys(filters).filter((k) => filters[k as keyof typeof filters]).length}
                </span>
              )}
            </button>
          </div>

          {/* Filtres dépliables */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Statut */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'draft', label: 'Brouillon', color: 'bg-gray-600' },
                    { value: 'submitted', label: 'Soumise', color: 'bg-blue-600' },
                    { value: 'pending_approval', label: 'En attente', color: 'bg-yellow-600' },
                    { value: 'approved', label: 'Approuvée', color: 'bg-green-600' },
                    { value: 'rejected', label: 'Rejetée', color: 'bg-red-600' },
                    { value: 'paid', label: 'Payée', color: 'bg-purple-600' },
                    { value: 'cancelled', label: 'Annulée', color: 'bg-gray-600' },
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => toggleStatus(status.value as ExpenseRequestStatus)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filters.status?.includes(status.value as ExpenseRequestStatus)
                          ? `${status.color} text-white`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Urgence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Urgence
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'low', label: 'Basse', color: 'bg-gray-600' },
                    { value: 'normal', label: 'Normale', color: 'bg-blue-600' },
                    { value: 'high', label: 'Haute', color: 'bg-orange-600' },
                    { value: 'urgent', label: 'URGENTE', color: 'bg-red-600' },
                  ].map((urgency) => (
                    <button
                      key={urgency.value}
                      onClick={() => toggleUrgency(urgency.value as ExpenseUrgency)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filters.urgency?.includes(urgency.value as ExpenseUrgency)
                          ? `${urgency.color} text-white`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {urgency.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catégorie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'fonctionnelle', label: 'Fonctionnelle' },
                    { value: 'structurelle', label: 'Structurelle' },
                  ].map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          category: filters.category === cat.value ? undefined : cat.value,
                        })
                      }
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filters.category === cat.value
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Du
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, dateFrom: e.target.value || undefined })
                    }
                    className="w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Au
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) =>
                      setFilters({ ...filters, dateTo: e.target.value || undefined })
                    }
                    className="w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Effacer tous les filtres
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Liste des demandes */}
        {filteredRequests.length > 0 ? (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <ExpenseRequestCard
                key={request.ExpenseRequestId}
                request={request}
                onClick={() => router.push(`/expenses/requests/${request.ExpenseRequestId}`)}
                showDetails={true}
                showApprovalActions={needsMyApproval && request.Status === 'submitted'}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl shadow">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {hasActiveFilters
                ? 'Aucune demande trouvée avec ces filtres'
                : 'Aucune demande pour le moment'}
            </p>
            {hasActiveFilters ? (
              <Button
                onClick={clearFilters}
                className="bg-gray-600 hover:bg-gray-700"
              >
                <X className="w-5 h-5 mr-2" />
                Effacer les filtres
              </Button>
            ) : (
              <Button
                onClick={() => router.push('/expenses/requests/quick')}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Créer une sollicitation
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
