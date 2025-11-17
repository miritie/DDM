'use client';

/**
 * Page - Dashboard IA Prédictif
 * Tableau de bord centralisé pour tous les insights et prévisions IA
 * Mobile-First avec permissions par rôle
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  TrendingUp,
  Package,
  Factory,
  AlertTriangle,
  Zap,
  BarChart3,
  Brain,
  Lock,
  Eye,
  Play,
} from 'lucide-react';
import { AIInsightsList, AIInsightsBadge } from '@/components/ai/ai-insight-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  totalInsights: number;
  newInsights: number;
  opportunitiesValue: number;
  risksCount: number;
  forecastsGenerated: number;
  suggestionsActive: number;
}

export default function AIDashboardPage() {
  const router = useRouter();

  const [userRole, setUserRole] = useState<string>('manager'); // TODO: Récupérer depuis session
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [productionSuggestions, setProductionSuggestions] = useState<any[]>([]);
  const [stockSuggestions, setStockSuggestions] = useState<any[]>([]);

  const [selectedTab, setSelectedTab] = useState<'insights' | 'forecasts' | 'production' | 'stock'>('insights');

  // Permissions simulées (TODO: utiliser vraies permissions)
  const [permissions, setPermissions] = useState({
    canViewForecasts: true,
    canViewSuggestions: true,
    canInteract: true,
    canSimulate: false,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      // Charger statistiques
      const statsResponse = await fetch('/api/ai/dashboard/stats');
      if (statsResponse.ok) {
        const result = await statsResponse.json();
        setStats(result.data);
      }

      // Charger insights
      const insightsResponse = await fetch('/api/ai/insights');
      if (insightsResponse.ok) {
        const result = await insightsResponse.json();
        setInsights(result.data || []);
      }

      // Charger prévisions
      if (permissions.canViewForecasts) {
        const forecastsResponse = await fetch('/api/ai/forecasts');
        if (forecastsResponse.ok) {
          const result = await forecastsResponse.json();
          setForecasts(result.data || []);
        }
      }

      // Charger suggestions production
      if (permissions.canViewSuggestions) {
        const prodResponse = await fetch('/api/ai/production/suggestions');
        if (prodResponse.ok) {
          const result = await prodResponse.json();
          setProductionSuggestions(result.data || []);
        }

        // Charger suggestions transferts stock
        const stockResponse = await fetch('/api/ai/stock/transfers');
        if (stockResponse.ok) {
          const result = await stockResponse.json();
          setStockSuggestions(result.data || []);
        }
      }
    } catch (error) {
      console.error('Erreur chargement dashboard IA:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyse en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header Gradient */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
                <Brain className="w-7 h-7" />
                IA Prédictive
              </h1>
              <p className="text-sm opacity-90">Pilotage intelligent basé sur vos données</p>
            </div>

            <div className="relative">
              <AIInsightsBadge count={stats?.newInsights || 0} pulse={true} />
            </div>
          </div>

          {/* KPIs */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="w-5 h-5" />
                  <span className="text-sm opacity-90">Insights</span>
                </div>
                <p className="text-3xl font-bold">{stats.totalInsights}</p>
                {stats.newInsights > 0 && (
                  <p className="text-xs opacity-80 mt-1">+{stats.newInsights} nouveau(x)</p>
                )}
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">Opportunités</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(stats.opportunitiesValue)} F
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm opacity-90">Alertes</span>
                </div>
                <p className="text-3xl font-bold">{stats.risksCount}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-5 h-5" />
                  <span className="text-sm opacity-90">Suggestions</span>
                </div>
                <p className="text-3xl font-bold">{stats.suggestionsActive}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Tabs Navigation */}
        <div className="bg-white rounded-2xl shadow-xl mb-4 overflow-hidden">
          <div className="grid grid-cols-4 border-b">
            <button
              onClick={() => setSelectedTab('insights')}
              className={`py-4 px-3 font-semibold text-center transition-colors relative ${
                selectedTab === 'insights'
                  ? 'text-purple-600 bg-purple-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Lightbulb className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">Insights</span>
              {selectedTab === 'insights' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-600"></div>
              )}
            </button>

            <button
              onClick={() => setSelectedTab('forecasts')}
              className={`py-4 px-3 font-semibold text-center transition-colors relative ${
                selectedTab === 'forecasts'
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <TrendingUp className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">Prévisions</span>
              {selectedTab === 'forecasts' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600"></div>
              )}
            </button>

            <button
              onClick={() => setSelectedTab('production')}
              className={`py-4 px-3 font-semibold text-center transition-colors relative ${
                selectedTab === 'production'
                  ? 'text-green-600 bg-green-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Factory className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">Production</span>
              {selectedTab === 'production' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-600"></div>
              )}
            </button>

            <button
              onClick={() => setSelectedTab('stock')}
              className={`py-4 px-3 font-semibold text-center transition-colors relative ${
                selectedTab === 'stock'
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Package className="w-5 h-5 mx-auto mb-1" />
              <span className="text-xs">Stock</span>
              {selectedTab === 'stock' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600"></div>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content: Insights */}
        {selectedTab === 'insights' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow">
              <h2 className="font-bold text-lg">Insights Actifs</h2>
              <Button
                onClick={() => loadDashboardData()}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Actualiser
              </Button>
            </div>

            <AIInsightsList
              insights={insights}
              onAction={(id, action) => {
                console.log('Action:', action, 'on', id);
                // TODO: Implémenter actions
              }}
              compact={true}
              maxDisplay={10}
            />
          </div>
        )}

        {/* Tab Content: Prévisions */}
        {selectedTab === 'forecasts' && (
          <div className="space-y-4">
            {!permissions.canViewForecasts ? (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8 text-center">
                <Lock className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="font-bold text-yellow-800 mb-2">Accès Limité</h3>
                <p className="text-yellow-700">
                  Votre rôle n'a pas accès aux prévisions de ventes.
                </p>
              </div>
            ) : forecasts.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-4">Aucune prévision générée</p>
                <Button
                  onClick={() => {
                    // TODO: Générer prévisions
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Générer Prévisions
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow">
                  <h2 className="font-bold text-lg mb-1">Prévisions de Ventes (30 jours)</h2>
                  <p className="text-sm text-gray-600">
                    Basées sur l'historique et les tendances détectées
                  </p>
                </div>

                {forecasts.map((forecast) => (
                  <div
                    key={forecast.ForecastId}
                    className="bg-white rounded-xl p-5 shadow-md border-l-4 border-blue-600"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{forecast.ProductName}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Période: {forecast.Period === '30_days' ? '30 jours' : forecast.Period}
                        </p>
                      </div>

                      <Badge
                        className={
                          forecast.ConfidenceLevel === 'very_high' || forecast.ConfidenceLevel === 'high'
                            ? 'bg-green-100 text-green-800'
                            : forecast.ConfidenceLevel === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }
                      >
                        Confiance: {forecast.ConfidenceLevel}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-semibold mb-1">Quantité Prévue</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {forecast.PredictedQuantity} unités
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-semibold mb-1">CA Prévu</p>
                        <p className="text-2xl font-bold text-green-900">
                          {new Intl.NumberFormat('fr-FR').format(forecast.PredictedRevenue)} F
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-700">
                      <div className="flex items-center gap-1">
                        <TrendingUp
                          className={`w-4 h-4 ${
                            forecast.TrendDirection === 'up'
                              ? 'text-green-600'
                              : forecast.TrendDirection === 'down'
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}
                        />
                        <span>
                          Tendance: {forecast.TrendDirection === 'up' ? '+' : forecast.TrendDirection === 'down' ? '-' : ''}
                          {Math.abs(forecast.TrendPercentage).toFixed(1)}%
                        </span>
                      </div>

                      <div className="text-gray-500">
                        {forecast.HistoricalDataPoints} points de données
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Production */}
        {selectedTab === 'production' && (
          <div className="space-y-4">
            {!permissions.canViewSuggestions ? (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8 text-center">
                <Lock className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="font-bold text-yellow-800 mb-2">Accès Limité</h3>
                <p className="text-yellow-700">
                  Votre rôle n'a pas accès aux suggestions de production.
                </p>
              </div>
            ) : productionSuggestions.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                <Factory className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-4">Aucune suggestion de production</p>
                <Button
                  onClick={() => {
                    // TODO: Générer suggestions
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Analyser Production
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow">
                  <h2 className="font-bold text-lg mb-1">Suggestions de Production</h2>
                  <p className="text-sm text-gray-600">
                    Basées sur les stocks actuels et prévisions de demande
                  </p>
                </div>

                {productionSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.SuggestionId}
                    className={`bg-white rounded-xl p-5 shadow-md border-l-4 ${
                      suggestion.Priority === 'urgent'
                        ? 'border-red-600 bg-red-50/30'
                        : suggestion.Priority === 'high'
                        ? 'border-orange-600'
                        : 'border-yellow-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{suggestion.ProductName}</h3>
                        <p className="text-sm text-gray-700 mt-2">{suggestion.Reasoning}</p>
                      </div>

                      <Badge
                        className={
                          suggestion.Priority === 'urgent'
                            ? 'bg-red-600 text-white animate-pulse'
                            : suggestion.Priority === 'high'
                            ? 'bg-orange-600 text-white'
                            : 'bg-yellow-600 text-white'
                        }
                      >
                        {suggestion.Priority.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">Quantité suggérée</p>
                        <p className="text-xl font-bold text-gray-900">
                          {suggestion.SuggestedQuantity} unités
                        </p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-600 mb-1">Profit estimé</p>
                        <p className="text-xl font-bold text-green-900">
                          {new Intl.NumberFormat('fr-FR').format(suggestion.EstimatedProfit)} F
                        </p>
                      </div>
                    </div>

                    {permissions.canInteract && (
                      <div className="flex gap-3">
                        <Button className="flex-1 bg-green-600 hover:bg-green-700">
                          <Play className="w-4 h-4 mr-2" />
                          Créer Production
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Eye className="w-4 h-4 mr-2" />
                          Détails
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Stock */}
        {selectedTab === 'stock' && (
          <div className="space-y-4">
            {!permissions.canViewSuggestions ? (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8 text-center">
                <Lock className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="font-bold text-yellow-800 mb-2">Accès Limité</h3>
                <p className="text-yellow-700">
                  Votre rôle n'a pas accès aux suggestions de transferts.
                </p>
              </div>
            ) : stockSuggestions.length === 0 ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-4">Aucune suggestion de transfert</p>
                <p className="text-sm text-gray-500">
                  Les stocks sont bien répartis ou nécessitent plus de données
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow">
                  <h2 className="font-bold text-lg mb-1">Suggestions de Transferts</h2>
                  <p className="text-sm text-gray-600">
                    Optimisation de la répartition des stocks entre emplacements
                  </p>
                </div>

                {stockSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.SuggestionId}
                    className="bg-white rounded-xl p-5 shadow-md border-l-4 border-orange-600"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-gray-900">{suggestion.ProductName}</h3>

                      <Badge
                        className={
                          suggestion.Priority === 'urgent'
                            ? 'bg-red-600 text-white'
                            : 'bg-orange-600 text-white'
                        }
                      >
                        {suggestion.Priority.toUpperCase()}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-700 mb-4">{suggestion.Reasoning}</p>

                    <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="text-gray-600 mb-1">De</p>
                          <p className="font-bold text-blue-900">{suggestion.FromLocationName}</p>
                          <p className="text-xs text-blue-700 mt-1">
                            Stock: {suggestion.FromCurrentStock} ({suggestion.FromDaysOfStock.toFixed(1)}j)
                          </p>
                        </div>

                        <div className="text-3xl text-gray-400">→</div>

                        <div className="text-right">
                          <p className="text-gray-600 mb-1">Vers</p>
                          <p className="font-bold text-green-900">{suggestion.ToLocationName}</p>
                          <p className="text-xs text-green-700 mt-1">
                            Stock: {suggestion.ToCurrentStock} ({suggestion.ToDaysOfStock.toFixed(1)}j)
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-600 mb-1">Quantité à transférer</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {suggestion.SuggestedQuantity} unités
                      </p>
                    </div>

                    {permissions.canInteract && (
                      <div className="flex gap-3">
                        <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
                          <Play className="w-4 h-4 mr-2" />
                          Créer Transfert
                        </Button>
                        <Button variant="outline" className="flex-1">
                          <Eye className="w-4 h-4 mr-2" />
                          Détails
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
