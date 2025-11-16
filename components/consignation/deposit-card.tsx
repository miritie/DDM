/**
 * Composant - DepositCard (Mobile-First)
 * Carte interactive pour afficher un dépôt de consignation
 */

'use client';

import { Deposit, DepositStatus } from '@/types/modules';
import {
  Package,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Eye,
} from 'lucide-react';

interface DepositCardProps {
  deposit: Deposit;
  onClick?: () => void;
  showDetails?: boolean;
}

/**
 * Configuration du badge de statut
 */
const getStatusConfig = (status: DepositStatus) => {
  const configs = {
    pending: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'En attente',
      icon: Clock,
      iconColor: 'text-yellow-600',
    },
    validated: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Validé',
      icon: CheckCircle,
      iconColor: 'text-blue-600',
    },
    partial: {
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      label: 'Partiel',
      icon: TrendingUp,
      iconColor: 'text-indigo-600',
    },
    completed: {
      color: 'bg-green-100 text-green-800 border-green-200',
      label: 'Terminé',
      icon: CheckCircle,
      iconColor: 'text-green-600',
    },
    cancelled: {
      color: 'bg-red-100 text-red-800 border-red-200',
      label: 'Annulé',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
    },
  };
  return configs[status] || configs.pending;
};

/**
 * Calcul du taux de vente
 */
const calculateSalesRate = (deposit: Deposit): number => {
  const totalDeposited = deposit.Lines.reduce((sum, line) => sum + line.QuantityDeposited, 0);
  const totalSold = deposit.Lines.reduce((sum, line) => sum + line.QuantitySold, 0);

  return totalDeposited > 0 ? (totalSold / totalDeposited) * 100 : 0;
};

/**
 * Calcul du taux de retour
 */
const calculateReturnRate = (deposit: Deposit): number => {
  const totalDeposited = deposit.Lines.reduce((sum, line) => sum + line.QuantityDeposited, 0);
  const totalReturned = deposit.Lines.reduce((sum, line) => sum + line.QuantityReturned, 0);

  return totalDeposited > 0 ? (totalReturned / totalDeposited) * 100 : 0;
};

export function DepositCard({ deposit, onClick, showDetails = true }: DepositCardProps) {
  const statusConfig = getStatusConfig(deposit.Status);
  const StatusIcon = statusConfig.icon;

  const salesRate = calculateSalesRate(deposit);
  const returnRate = calculateReturnRate(deposit);

  // Gradient selon statut
  const getHeaderGradient = (status: DepositStatus) => {
    const gradients = {
      pending: 'from-yellow-500 to-orange-600',
      validated: 'from-blue-500 to-cyan-600',
      partial: 'from-indigo-500 to-purple-600',
      completed: 'from-green-500 to-emerald-600',
      cancelled: 'from-red-500 to-pink-600',
    };
    return gradients[status] || gradients.pending;
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all ${
        onClick ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' : ''
      }`}
      onClick={onClick}
    >
      {/* Header avec statut */}
      <div className={`bg-gradient-to-r ${getHeaderGradient(deposit.Status)} p-4`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-white font-bold text-lg">{deposit.DepositNumber}</h3>
            <p className="text-white/90 text-sm line-clamp-1">{deposit.PartnerName}</p>
          </div>

          <div className={`px-3 py-1 rounded-full border-2 bg-white/20 backdrop-blur-sm ${statusConfig.color.replace('bg-', 'border-')}`}>
            <span className="text-xs font-semibold text-white flex items-center gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-white/90 text-sm">
          <div className="flex items-center gap-1">
            <Package className="w-4 h-4" />
            <span>{deposit.TotalItems} articles</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(deposit.DepositDate).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        {/* Valeur totale */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4">
          <span className="text-sm text-gray-600">Valeur totale du dépôt</span>
          <p className="text-2xl font-bold text-indigo-700 mt-1">
            {new Intl.NumberFormat('fr-FR').format(deposit.TotalValue)} F
          </p>
        </div>

        {showDetails && (
          <>
            {/* Progression (si dépôt actif) */}
            {(deposit.Status === 'validated' || deposit.Status === 'partial') && (
              <>
                {/* Barres de progression */}
                <div className="space-y-3">
                  {/* Taux de vente */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Taux de vente</span>
                      <span className="text-sm font-bold text-green-700">{Math.round(salesRate)}%</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all rounded-full"
                        style={{ width: `${Math.min(salesRate, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Taux de retour */}
                  {returnRate > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Taux de retour</span>
                        <span className="text-sm font-bold text-orange-700">{Math.round(returnRate)}%</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all rounded-full"
                          style={{ width: `${Math.min(returnRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Statistiques par ligne */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-600 mb-1">Déposé</p>
                    <p className="font-bold text-blue-700">
                      {deposit.Lines.reduce((sum, l) => sum + l.QuantityDeposited, 0)}
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-600 mb-1">Vendu</p>
                    <p className="font-bold text-green-700">
                      {deposit.Lines.reduce((sum, l) => sum + l.QuantitySold, 0)}
                    </p>
                  </div>

                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-600 mb-1">Restant</p>
                    <p className="font-bold text-orange-700">
                      {deposit.Lines.reduce((sum, l) => sum + l.QuantityRemaining, 0)}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Informations complémentaires */}
            <div className="border-t pt-3 space-y-2 text-sm">
              {deposit.PreparedByName && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Préparé par</span>
                  <span className="font-semibold text-gray-900">{deposit.PreparedByName}</span>
                </div>
              )}

              {deposit.ValidatedByName && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Validé par</span>
                  <span className="font-semibold text-gray-900">{deposit.ValidatedByName}</span>
                </div>
              )}

              {deposit.ExpectedReturnDate && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Retour prévu</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(deposit.ExpectedReturnDate).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Indicateur pour voir plus de détails */}
        {onClick && (
          <div className="flex items-center justify-center text-indigo-600 pt-2">
            <Eye className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">Voir le détail</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
