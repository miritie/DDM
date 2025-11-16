/**
 * Composant - AI Insight Card Mobile-First
 * Affichage contextuel d'insights IA sur tous les écrans
 */

'use client';

import { useState } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Zap,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AIInsight {
  InsightId: string;
  Type: 'opportunity' | 'risk' | 'optimization' | 'alert';
  Category: 'sales' | 'stock' | 'production' | 'finance' | 'customer' | 'hr';

  Title: string;
  Description: string;
  Impact: 'low' | 'medium' | 'high' | 'critical';

  RelatedData: Record<string, any>;
  RecommendedActions: string[];

  EstimatedImpactAmount?: number;
  EstimatedImpactPercentage?: number;

  Status: 'new' | 'viewed' | 'actioned' | 'dismissed';
}

interface AIInsightCardProps {
  insight: AIInsight;
  onAction?: (insightId: string, action: 'view' | 'act' | 'dismiss') => void;
  showActions?: boolean;
  compact?: boolean;
}

export function AIInsightCard({
  insight,
  onAction,
  showActions = true,
  compact = false,
}: AIInsightCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Configuration visuelle par type
  const getTypeConfig = (type: AIInsight['Type']) => {
    const configs = {
      opportunity: {
        icon: TrendingUp,
        gradient: 'from-green-500 to-emerald-600',
        bgLight: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
      },
      risk: {
        icon: AlertTriangle,
        gradient: 'from-red-500 to-rose-600',
        bgLight: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
      },
      optimization: {
        icon: Zap,
        gradient: 'from-orange-500 to-amber-600',
        bgLight: 'bg-orange-50',
        borderColor: 'border-orange-200',
        textColor: 'text-orange-800',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
      },
      alert: {
        icon: AlertTriangle,
        gradient: 'from-yellow-500 to-orange-600',
        bgLight: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
      },
    };

    return configs[type];
  };

  // Configuration impact
  const getImpactConfig = (impact: AIInsight['Impact']) => {
    const configs = {
      critical: { label: 'CRITIQUE', color: 'bg-red-600', pulse: true },
      high: { label: 'ÉLEVÉ', color: 'bg-orange-600', pulse: false },
      medium: { label: 'MOYEN', color: 'bg-yellow-600', pulse: false },
      low: { label: 'FAIBLE', color: 'bg-gray-600', pulse: false },
    };

    return configs[impact];
  };

  const config = getTypeConfig(insight.Type);
  const impactConfig = getImpactConfig(insight.Impact);
  const Icon = config.icon;

  const handleAction = (action: 'view' | 'act' | 'dismiss') => {
    onAction?.(insight.InsightId, action);

    if (action === 'view' && !expanded) {
      setExpanded(true);
    }
  };

  // Mode compact (liste)
  if (compact) {
    return (
      <div
        onClick={() => setExpanded(!expanded)}
        className={`${config.bgLight} ${config.borderColor} border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md`}
      >
        <div className="flex items-start gap-3">
          <div className={`${config.iconBg} rounded-full p-2 flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold text-sm ${config.textColor}`}>{insight.Title}</h4>
              {insight.Status === 'new' && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                  Nouveau
                </span>
              )}
            </div>

            <p className="text-xs text-gray-600 line-clamp-2">{insight.Description}</p>

            {insight.EstimatedImpactPercentage && (
              <p className="text-xs font-semibold text-gray-700 mt-1">
                Impact estimé: {insight.EstimatedImpactPercentage > 0 ? '+' : ''}
                {insight.EstimatedImpactPercentage.toFixed(1)}%
              </p>
            )}
          </div>

          <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h5 className="font-semibold text-sm text-gray-800 mb-2">Actions recommandées:</h5>
            <ul className="space-y-2">
              {insight.RecommendedActions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-600 flex-shrink-0">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>

            {showActions && (
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction('act');
                  }}
                  size="sm"
                  className={`flex-1 bg-gradient-to-r ${config.gradient} text-white hover:opacity-90`}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Agir
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction('dismiss');
                  }}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Ignorer
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Mode full (card détaillée)
  return (
    <div className={`${config.bgLight} border-2 ${config.borderColor} rounded-2xl shadow-lg overflow-hidden`}>
      {/* Header avec gradient */}
      <div className={`bg-gradient-to-r ${config.gradient} text-white p-4`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
              <Icon className="w-6 h-6" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg">{insight.Title}</h3>
                {insight.Status === 'new' && (
                  <span
                    className={`${impactConfig.pulse ? 'animate-pulse' : ''} ${impactConfig.color} text-white text-xs px-2 py-1 rounded-full font-bold`}
                  >
                    {impactConfig.label}
                  </span>
                )}
              </div>

              <p className="text-sm opacity-90">{insight.Description}</p>
            </div>
          </div>

          {showActions && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-white/80 hover:text-white transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-6 h-6" />
              ) : (
                <ChevronDown className="w-6 h-6" />
              )}
            </button>
          )}
        </div>

        {/* Impact estimé */}
        {(insight.EstimatedImpactAmount || insight.EstimatedImpactPercentage) && (
          <div className="mt-3 flex items-center gap-4">
            {insight.EstimatedImpactAmount && (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <p className="text-xs opacity-80">Impact financier</p>
                <p className="text-xl font-bold">
                  {insight.EstimatedImpactAmount > 0 ? '+' : ''}
                  {new Intl.NumberFormat('fr-FR').format(insight.EstimatedImpactAmount)} F
                </p>
              </div>
            )}

            {insight.EstimatedImpactPercentage && (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2">
                <p className="text-xs opacity-80">Variation</p>
                <p className="text-xl font-bold">
                  {insight.EstimatedImpactPercentage > 0 ? '+' : ''}
                  {insight.EstimatedImpactPercentage.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contenu dépliable */}
      {expanded && (
        <div className="p-4">
          {/* Actions recommandées */}
          <div className="mb-4">
            <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              Actions recommandées
            </h4>

            <ul className="space-y-3">
              {insight.RecommendedActions.map((action, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 bg-white rounded-lg p-3 border border-gray-200"
                >
                  <div className="bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 font-bold text-sm">{idx + 1}</span>
                  </div>
                  <p className="text-gray-800 flex-1">{action}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Données liées (optionnel) */}
          {insight.RelatedData && Object.keys(insight.RelatedData).length > 0 && (
            <div className="mb-4">
              <h4 className="font-bold text-gray-900 mb-2">Détails</h4>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(insight.RelatedData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => handleAction('act')}
                className={`flex-1 h-12 text-base font-semibold bg-gradient-to-r ${config.gradient} hover:opacity-90`}
              >
                <Check className="w-5 h-5 mr-2" />
                Appliquer les recommandations
              </Button>

              <Button
                onClick={() => handleAction('dismiss')}
                variant="outline"
                className="h-12 text-base font-semibold border-2"
              >
                <X className="w-5 h-5 mr-2" />
                Ignorer
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Composant - Liste d'Insights IA
 */
interface AIInsightsListProps {
  insights: AIInsight[];
  onAction?: (insightId: string, action: 'view' | 'act' | 'dismiss') => void;
  compact?: boolean;
  maxDisplay?: number;
}

export function AIInsightsList({
  insights,
  onAction,
  compact = true,
  maxDisplay,
}: AIInsightsListProps) {
  const [showAll, setShowAll] = useState(false);

  if (insights.length === 0) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
        <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Aucun insight IA disponible pour le moment</p>
        <p className="text-sm text-gray-500 mt-1">
          L'IA analyse vos données en continu pour détecter opportunités et risques
        </p>
      </div>
    );
  }

  const displayedInsights = maxDisplay && !showAll
    ? insights.slice(0, maxDisplay)
    : insights;

  const hasMore = maxDisplay && insights.length > maxDisplay && !showAll;

  return (
    <div className="space-y-3">
      {displayedInsights.map((insight) => (
        <AIInsightCard
          key={insight.InsightId}
          insight={insight}
          onAction={onAction}
          compact={compact}
        />
      ))}

      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition-colors"
        >
          Voir {insights.length - maxDisplay} insights supplémentaires
        </button>
      )}
    </div>
  );
}

/**
 * Composant - Badge compteur d'insights non vus
 */
interface AIInsightsBadgeProps {
  count: number;
  pulse?: boolean;
}

export function AIInsightsBadge({ count, pulse = true }: AIInsightsBadgeProps) {
  if (count === 0) return null;

  return (
    <div
      className={`${
        pulse ? 'animate-pulse' : ''
      } bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center`}
    >
      {count > 99 ? '99+' : count}
    </div>
  );
}

/**
 * Composant - Bouton IA contextuel
 * À placer sur chaque écran pour afficher insights contextuels
 */
interface AIContextButtonProps {
  insightsCount: number;
  onClick: () => void;
  variant?: 'floating' | 'inline';
}

export function AIContextButton({
  insightsCount,
  onClick,
  variant = 'floating',
}: AIContextButtonProps) {
  if (variant === 'floating') {
    return (
      <button
        onClick={onClick}
        className="fixed bottom-20 right-4 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full p-4 shadow-2xl hover:shadow-3xl transition-all hover:scale-110 active:scale-95"
      >
        <div className="relative">
          <Lightbulb className="w-7 h-7" />
          {insightsCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
              {insightsCount}
            </div>
          )}
        </div>
      </button>
    );
  }

  return (
    <Button
      onClick={onClick}
      className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90"
    >
      <Lightbulb className="w-5 h-5 mr-2" />
      Insights IA
      {insightsCount > 0 && (
        <span className="ml-2 bg-white/30 px-2 py-0.5 rounded-full text-xs font-bold">
          {insightsCount}
        </span>
      )}
    </Button>
  );
}
