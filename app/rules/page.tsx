'use client';

/**
 * Page - Gestion des Règles Métier
 * Dashboard et liste des règles automatisées
 * Mobile-First
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Plus,
  Filter,
  Search,
  Play,
  Pause,
  Copy,
  Edit,
  Trash2,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Rule {
  RuleId: string;
  RuleCode: string;
  Name: string;
  Description: string;
  DecisionType: string;
  IsActive: boolean;
  Priority: number;
  TotalTriggered: number;
  TotalAutoExecuted: number;
  TotalApproved: number;
  TotalRejected: number;
  SuccessRate: number;
  AutoExecute: boolean;
  RequiresApproval: boolean;
  Tags?: string[];
  CreatedAt: string;
}

interface DashboardStats {
  totalRules: number;
  activeRules: number;
  inactiveRules: number;
  totalExecutionsToday: number;
  totalAutoExecutedToday: number;
  topPerformingRules: Array<{ ruleName: string; successRate: number }>;
}

export default function RulesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [filteredRules, setFilteredRules] = useState<Rule[]>([]);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{
    search?: string;
    decisionType?: string;
    isActive?: boolean;
    tag?: string;
  }>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rules, filters]);

  async function loadData() {
    try {
      setLoading(true);

      // Charger statistiques
      const statsResponse = await fetch('/api/rules/dashboard');
      if (statsResponse.ok) {
        const result = await statsResponse.json();
        setStats(result.data);
      }

      // Charger règles
      const rulesResponse = await fetch('/api/rules');
      if (rulesResponse.ok) {
        const result = await rulesResponse.json();
        setRules(result.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement règles:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...rules];

    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.Name.toLowerCase().includes(query) ||
          r.Description.toLowerCase().includes(query) ||
          r.RuleCode.toLowerCase().includes(query)
      );
    }

    if (filters.decisionType) {
      filtered = filtered.filter(r => r.DecisionType === filters.decisionType);
    }

    if (filters.isActive !== undefined) {
      filtered = filtered.filter(r => r.IsActive === filters.isActive);
    }

    if (filters.tag) {
      filtered = filtered.filter(r => filters.tag && r.Tags?.includes(filters.tag));
    }

    setFilteredRules(filtered);
  }

  async function toggleRule(ruleId: string, currentStatus: boolean) {
    try {
      const response = await fetch(`/api/rules/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Erreur toggle règle:', error);
    }
  }

  async function duplicateRule(ruleId: string) {
    try {
      const response = await fetch(`/api/rules/${ruleId}/duplicate`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Erreur duplication règle:', error);
    }
  }

  async function deleteRule(ruleId: string, ruleName: string) {
    if (!confirm(`Supprimer la règle "${ruleName}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Erreur suppression règle:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
                <Zap className="w-7 h-7" />
                Règles Métier
              </h1>
              <p className="text-sm opacity-90">Automatisation intelligente de vos décisions</p>
            </div>

            <Button
              onClick={() => router.push('/rules/new')}
              className="bg-white text-blue-600 hover:bg-blue-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nouvelle
            </Button>
          </div>

          {/* KPIs */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-5 h-5" />
                  <span className="text-sm opacity-90">Total</span>
                </div>
                <p className="text-3xl font-bold">{stats.totalRules}</p>
                <p className="text-xs opacity-80 mt-1">
                  {stats.activeRules} actives
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Play className="w-5 h-5" />
                  <span className="text-sm opacity-90">Exécutions</span>
                </div>
                <p className="text-3xl font-bold">{stats.totalExecutionsToday}</p>
                <p className="text-xs opacity-80 mt-1">aujourd'hui</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-5 h-5" />
                  <span className="text-sm opacity-90">Auto-exec</span>
                </div>
                <p className="text-3xl font-bold">{stats.totalAutoExecutedToday}</p>
                <p className="text-xs opacity-80 mt-1">automatiques</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">Top Règle</span>
                </div>
                <p className="text-2xl font-bold">
                  {stats.topPerformingRules[0]?.successRate || 0}%
                </p>
                <p className="text-xs opacity-80 mt-1 truncate">
                  {stats.topPerformingRules[0]?.ruleName || 'N/A'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Barre de recherche */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
              placeholder="Rechercher une règle..."
              className="w-full pl-12 pr-24 h-12 text-base border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 px-4 h-9 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                showFilters
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
                  <button
                    onClick={() => setFilters({ ...filters, isActive: undefined })}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filters.isActive === undefined
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Toutes
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, isActive: true })}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filters.isActive === true
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Actives
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, isActive: false })}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filters.isActive === false
                        ? 'bg-gray-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Inactives
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compteur */}
        <div className="mb-4 px-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filteredRules.length}</span>{' '}
            {filteredRules.length > 1 ? 'règles trouvées' : 'règle trouvée'}
          </p>
        </div>

        {/* Liste des règles */}
        <div className="space-y-4">
          {filteredRules.length > 0 ? (
            filteredRules.map(rule => (
              <div
                key={rule.RuleId}
                className="bg-white rounded-2xl shadow-md p-5 border-l-4"
                style={{
                  borderLeftColor: rule.IsActive ? '#3b82f6' : '#9ca3af',
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{rule.Name}</h3>
                      {rule.IsActive ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                      )}
                      {rule.AutoExecute && (
                        <Badge className="bg-purple-100 text-purple-800">
                          <Zap className="w-3 h-3 mr-1" />
                          Auto
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 mb-2">{rule.Description}</p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="font-mono">{rule.RuleCode}</span>
                      <span>Type: {rule.DecisionType}</span>
                      <span>Priorité: {rule.Priority}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-blue-600 font-semibold mb-0.5">Déclenchée</p>
                    <p className="text-lg font-bold text-blue-900">{rule.TotalTriggered || 0}</p>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-purple-600 font-semibold mb-0.5">Auto-exec</p>
                    <p className="text-lg font-bold text-purple-900">{rule.TotalAutoExecuted || 0}</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-green-600 font-semibold mb-0.5">Approuvée</p>
                    <p className="text-lg font-bold text-green-900">{rule.TotalApproved || 0}</p>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-orange-600 font-semibold mb-0.5">Succès</p>
                    <p className="text-lg font-bold text-orange-900">
                      {rule.SuccessRate ? `${rule.SuccessRate.toFixed(0)}%` : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleRule(rule.RuleId, rule.IsActive)}
                    className={`flex-1 h-10 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      rule.IsActive
                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {rule.IsActive ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Désactiver
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Activer
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => router.push(`/rules/${rule.RuleId}/edit`)}
                    className="flex-1 h-10 px-4 rounded-lg font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Modifier
                  </button>

                  <button
                    onClick={() => duplicateRule(rule.RuleId)}
                    className="h-10 px-4 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Dupliquer
                  </button>

                  <button
                    onClick={() => deleteRule(rule.RuleId, rule.Name)}
                    className="h-10 px-4 rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucune règle trouvée</p>
              <Button
                onClick={() => router.push('/rules/new')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Créer une règle
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
