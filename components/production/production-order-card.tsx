/**
 * Composant - ProductionOrderCard (Mobile-First)
 * Carte visuelle pour afficher un ordre de production
 */

'use client';

import { ProductionOrder, ProductionOrderStatus } from '@/types/modules';
import {
  Factory,
  Calendar,
  Package,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  PlayCircle,
  XCircle,
  ChevronRight,
  User,
} from 'lucide-react';

interface ProductionOrderCardProps {
  order: ProductionOrder;
  onClick?: () => void;
  showDetails?: boolean;
}

/**
 * Configuration du badge de statut
 */
const getStatusConfig = (status: ProductionOrderStatus) => {
  const configs = {
    draft: {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      label: 'Brouillon',
      icon: Clock,
      iconColor: 'text-gray-600',
      gradient: 'from-gray-400 to-gray-600',
    },
    planned: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Planifié',
      icon: Calendar,
      iconColor: 'text-blue-600',
      gradient: 'from-blue-500 to-cyan-600',
    },
    in_progress: {
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      label: 'En cours',
      icon: PlayCircle,
      iconColor: 'text-orange-600',
      gradient: 'from-orange-500 to-amber-600',
    },
    completed: {
      color: 'bg-green-100 text-green-800 border-green-200',
      label: 'Terminé',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      gradient: 'from-green-500 to-emerald-600',
    },
    cancelled: {
      color: 'bg-red-100 text-red-800 border-red-200',
      label: 'Annulé',
      icon: XCircle,
      iconColor: 'text-red-600',
      gradient: 'from-red-500 to-pink-600',
    },
  };
  return configs[status] || configs.draft;
};

/**
 * Configuration de la priorité
 */
const getPriorityConfig = (priority: string) => {
  const configs = {
    low: { label: 'Basse', color: 'bg-gray-100 text-gray-700' },
    normal: { label: 'Normale', color: 'bg-blue-100 text-blue-700' },
    high: { label: 'Haute', color: 'bg-orange-100 text-orange-700' },
    urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
  };
  return configs[priority as keyof typeof configs] || configs.normal;
};

export function ProductionOrderCard({
  order,
  onClick,
  showDetails = true,
}: ProductionOrderCardProps) {
  const statusConfig = getStatusConfig(order.Status);
  const priorityConfig = getPriorityConfig(order.Priority);
  const StatusIcon = statusConfig.icon;

  // Calcul du progrès
  const progressPercent =
    order.PlannedQuantity > 0
      ? Math.min(100, (order.ProducedQuantity / order.PlannedQuantity) * 100)
      : 0;

  // Dates
  const startDate = order.ActualStartDate || order.PlannedStartDate;
  const endDate = order.ActualEndDate || order.PlannedEndDate;

  return (
    <div
      className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all ${
        onClick
          ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
          : ''
      }`}
      onClick={onClick}
    >
      {/* Header avec statut */}
      <div className={`bg-gradient-to-r ${statusConfig.gradient} p-4`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg">{order.OrderNumber}</h3>
            <p className="text-white/90 text-sm line-clamp-1">
              {order.ProductName || 'Produit'}
            </p>
          </div>

          <div
            className={`px-3 py-1 rounded-full border-2 bg-white/20 backdrop-blur-sm ${statusConfig.color.replace(
              'bg-',
              'border-'
            )}`}
          >
            <span className="text-xs font-semibold text-white flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-white/90 text-sm">
          <div className="flex items-center gap-1">
            <Factory className="w-4 h-4" />
            <span>{order.RecipeName || 'Recette'}</span>
          </div>
          {order.Priority !== 'normal' && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        {/* Production */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
            <span className="text-xs text-gray-600">Planifié</span>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {order.PlannedQuantity}
            </p>
            <p className="text-xs text-blue-600">{order.Unit}</p>
          </div>

          <div
            className={`rounded-xl p-4 ${
              order.ProducedQuantity >= order.PlannedQuantity
                ? 'bg-gradient-to-br from-green-50 to-emerald-50'
                : 'bg-gradient-to-br from-orange-50 to-amber-50'
            }`}
          >
            <span className="text-xs text-gray-600">Produit</span>
            <p
              className={`text-2xl font-bold mt-1 ${
                order.ProducedQuantity >= order.PlannedQuantity
                  ? 'text-green-700'
                  : 'text-orange-700'
              }`}
            >
              {order.ProducedQuantity}
            </p>
            <p
              className={`text-xs ${
                order.ProducedQuantity >= order.PlannedQuantity
                  ? 'text-green-600'
                  : 'text-orange-600'
              }`}
            >
              {order.Unit}
            </p>
          </div>
        </div>

        {showDetails && (
          <>
            {/* Barre de progression */}
            {order.Status === 'in_progress' || order.Status === 'completed' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Progression
                  </span>
                  <span className="text-sm font-bold text-green-700">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all rounded-full"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span className="text-xs text-gray-600">Début</span>
                </div>
                <p className="font-semibold text-gray-900">
                  {new Date(startDate).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span className="text-xs text-gray-600">Fin</span>
                </div>
                <p className="font-semibold text-gray-900">
                  {new Date(endDate).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </p>
              </div>
            </div>

            {/* Rendement et Coût */}
            <div className="grid grid-cols-2 gap-3">
              {order.YieldRate > 0 && (
                <div className="bg-purple-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <span className="text-xs text-gray-600">Rendement</span>
                  </div>
                  <p className="text-xl font-bold text-purple-700">
                    {order.YieldRate}%
                  </p>
                </div>
              )}

              {order.TotalCost > 0 && (
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Package className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-gray-600">Coût</span>
                  </div>
                  <p className="text-lg font-bold text-green-700">
                    {new Intl.NumberFormat('fr-FR').format(order.TotalCost)} F
                  </p>
                </div>
              )}
            </div>

            {/* Assignation */}
            {order.AssignedToName && (
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Chef d'Usine</span>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-700">
                      {order.AssignedToName}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Lots produits */}
            {order.Batches && order.Batches.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Lots produits ({order.Batches.length})
                </p>
                <div className="space-y-2">
                  {order.Batches.slice(0, 2).map((batch) => (
                    <div
                      key={batch.BatchId}
                      className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2"
                    >
                      <span className="text-gray-700">{batch.BatchNumber}</span>
                      <span className="font-semibold text-gray-900">
                        {batch.QuantityGood} {batch.Unit}
                      </span>
                    </div>
                  ))}
                  {order.Batches.length > 2 && (
                    <p className="text-xs text-gray-500 italic">
                      +{order.Batches.length - 2} autre(s) lot(s)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Alerte retard */}
            {order.Status === 'in_progress' &&
              new Date(order.PlannedEndDate) < new Date() && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      Production en retard
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Date de fin planifiée dépassée
                    </p>
                  </div>
                </div>
              )}

            {/* Notes */}
            {order.Notes && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Notes</p>
                <p className="text-sm text-gray-700 line-clamp-2">{order.Notes}</p>
              </div>
            )}
          </>
        )}

        {/* Indicateur pour voir plus */}
        {onClick && (
          <div className="flex items-center justify-center text-orange-600 pt-2">
            <Factory className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">Voir l'ordre</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
