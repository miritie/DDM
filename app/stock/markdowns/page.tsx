'use client';

/**
 * Page - Liste des Démarques (Mobile-First)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingDown,
  Plus,
  AlertTriangle,
  Calendar,
  Package,
  Filter,
  X,
  FileText,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Markdown {
  MarkdownId: string;
  MarkdownNumber: string;
  WarehouseId: string;
  WarehouseName?: string;
  MarkdownDate: string;
  TotalQuantity: number;
  Status: 'pending' | 'validated' | 'cancelled';
  Notes?: string;
  Reason?: string;
}

interface MarkdownStatistics {
  totalMarkdowns: number;
  totalQuantity: number;
  byReason: Record<string, number>;
  thisMonth: number;
}

const reasonLabels: Record<string, { label: string; color: string }> = {
  damaged: { label: 'Cassé', color: 'bg-orange-100 text-orange-800' },
  expired: { label: 'Expiré', color: 'bg-red-100 text-red-800' },
  theft: { label: 'Vol', color: 'bg-purple-100 text-purple-800' },
  loss: { label: 'Perte', color: 'bg-blue-100 text-blue-800' },
  quality: { label: 'Qualité', color: 'bg-yellow-100 text-yellow-800' },
  other: { label: 'Autre', color: 'bg-gray-100 text-gray-800' },
};

export default function MarkdownsPage() {
  const router = useRouter();
  const [markdowns, setMarkdowns] = useState<Markdown[]>([]);
  const [filteredMarkdowns, setFilteredMarkdowns] = useState<Markdown[]>([]);
  const [statistics, setStatistics] = useState<MarkdownStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    status?: string;
    reason?: string;
  }>({});

  useEffect(() => {
    loadMarkdowns();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [markdowns, filters]);

  async function loadMarkdowns() {
    try {
      setLoading(true);
      const response = await fetch('/api/stock/markdowns');
      const result = await response.json();

      if (response.ok) {
        setMarkdowns(result.data || []);
        calculateStatistics(result.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement démarques:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateStatistics(data: Markdown[]) {
    const totalQuantity = data.reduce((sum, m) => sum + m.TotalQuantity, 0);

    const byReason: Record<string, number> = {};
    data.forEach((m) => {
      if (m.Reason) {
        byReason[m.Reason] = (byReason[m.Reason] || 0) + m.TotalQuantity;
      }
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = data.filter(
      (m) => new Date(m.MarkdownDate) >= firstDayOfMonth
    ).length;

    setStatistics({
      totalMarkdowns: data.length,
      totalQuantity,
      byReason,
      thisMonth,
    });
  }

  function applyFilters() {
    let filtered = [...markdowns];

    if (filters.status) {
      filtered = filtered.filter((m) => m.Status === filters.status);
    }

    if (filters.reason) {
      filtered = filtered.filter((m) => m.Reason === filters.reason);
    }

    setFilteredMarkdowns(filtered);
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
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingDown className="w-7 h-7" />
              Démarques
            </h1>

            <Button
              onClick={() => router.push('/stock/markdowns/new')}
              className="bg-white text-red-600 hover:bg-red-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouvelle
            </Button>
          </div>

          {/* KPIs */}
          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm opacity-90">Total</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalMarkdowns}</p>
                <p className="text-xs opacity-80 mt-1">Démarques</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-5 h-5" />
                  <span className="text-sm opacity-90">Quantité</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalQuantity}</p>
                <p className="text-xs opacity-80 mt-1">Unités</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-5 h-5" />
                  <span className="text-sm opacity-90">Ce mois</span>
                </div>
                <p className="text-3xl font-bold">{statistics.thisMonth}</p>
                <p className="text-xs opacity-80 mt-1">Démarques</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm opacity-90">Principale</span>
                </div>
                {Object.keys(statistics.byReason).length > 0 ? (
                  <>
                    <p className="text-2xl font-bold">
                      {Math.max(...Object.values(statistics.byReason))}
                    </p>
                    <p className="text-xs opacity-80 mt-1">
                      {
                        reasonLabels[
                          Object.keys(statistics.byReason).reduce((a, b) =>
                            statistics.byReason[a] > statistics.byReason[b] ? a : b
                          )
                        ]?.label
                      }
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-bold">-</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`w-full flex items-center justify-between px-4 py-2 rounded-lg font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtres
            </span>
            {hasActiveFilters && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                Actifs
              </span>
            )}
          </button>

          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'validated', 'cancelled'].map((status) => (
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
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status === 'pending' && 'En attente'}
                      {status === 'validated' && 'Validé'}
                      {status === 'cancelled' && 'Annulé'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Raison
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(reasonLabels).map((reason) => (
                    <button
                      key={reason}
                      onClick={() =>
                        setFilters({
                          ...filters,
                          reason: filters.reason === reason ? undefined : reason,
                        })
                      }
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filters.reason === reason
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {reasonLabels[reason].label}
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
            <span className="font-semibold text-gray-900">
              {filteredMarkdowns.length}
            </span>{' '}
            {filteredMarkdowns.length > 1 ? 'démarques trouvées' : 'démarque trouvée'}
          </p>
        </div>

        {/* Liste */}
        <div className="space-y-4">
          {filteredMarkdowns.length > 0 ? (
            filteredMarkdowns.map((markdown) => (
              <div
                key={markdown.MarkdownId}
                onClick={() => router.push(`/stock/markdowns/${markdown.MarkdownId}`)}
                className="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <div className="bg-gradient-to-r from-red-500 to-pink-600 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-white font-bold text-lg">
                        {markdown.MarkdownNumber}
                      </h3>
                      {markdown.WarehouseName && (
                        <p className="text-white/90 text-sm">
                          {markdown.WarehouseName}
                        </p>
                      )}
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        markdown.Status === 'validated'
                          ? 'bg-green-100 text-green-800'
                          : markdown.Status === 'cancelled'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {markdown.Status === 'validated' && 'Validé'}
                      {markdown.Status === 'pending' && 'En attente'}
                      {markdown.Status === 'cancelled' && 'Annulé'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-white/90 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(markdown.MarkdownDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-red-50 rounded-xl p-4">
                    <span className="text-xs text-gray-600">Quantité démarquée</span>
                    <p className="text-2xl font-bold text-red-700 mt-1">
                      {markdown.TotalQuantity} unités
                    </p>
                  </div>

                  {markdown.Reason && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${reasonLabels[markdown.Reason]?.color}`}
                      >
                        {reasonLabels[markdown.Reason]?.label}
                      </span>
                    </div>
                  )}

                  {markdown.Notes && (
                    <p className="text-sm text-gray-600 italic">{markdown.Notes}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucune démarque trouvée</p>
              <Button
                onClick={() => router.push('/stock/markdowns/new')}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Créer une démarque
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
