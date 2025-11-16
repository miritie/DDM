/**
 * Composant - SettlementCard (Mobile-First)
 * Carte interactive pour afficher un règlement financier
 */

'use client';

import { Settlement, SettlementStatus } from '@/types/modules';
import {
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Smartphone,
  Banknote,
  ChevronRight,
} from 'lucide-react';

interface SettlementCardProps {
  settlement: Settlement;
  onClick?: () => void;
  showDetails?: boolean;
}

/**
 * Configuration du badge de statut
 */
const getStatusConfig = (status: SettlementStatus) => {
  const configs = {
    pending: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'En attente',
      icon: Clock,
      iconColor: 'text-yellow-600',
      gradient: 'from-yellow-500 to-orange-600',
    },
    partial: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Partiel',
      icon: DollarSign,
      iconColor: 'text-blue-600',
      gradient: 'from-blue-500 to-cyan-600',
    },
    completed: {
      color: 'bg-green-100 text-green-800 border-green-200',
      label: 'Payé',
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
  return configs[status] || configs.pending;
};

/**
 * Icône selon mode de paiement
 */
const getPaymentMethodIcon = (method?: string) => {
  const icons = {
    cash: Banknote,
    bank_transfer: CreditCard,
    mobile_money: Smartphone,
    check: FileText,
  };
  return icons[method as keyof typeof icons] || DollarSign;
};

/**
 * Label mode de paiement
 */
const getPaymentMethodLabel = (method?: string) => {
  const labels = {
    cash: 'Espèces',
    bank_transfer: 'Virement',
    mobile_money: 'Mobile Money',
    check: 'Chèque',
  };
  return labels[method as keyof typeof labels] || 'Non défini';
};

export function SettlementCard({
  settlement,
  onClick,
  showDetails = true,
}: SettlementCardProps) {
  const statusConfig = getStatusConfig(settlement.Status);
  const StatusIcon = statusConfig.icon;
  const PaymentIcon = getPaymentMethodIcon(settlement.PaymentMethod);

  // Calcul progression paiement
  const paymentProgress =
    settlement.TotalDue > 0
      ? (settlement.AmountPaid / settlement.TotalDue) * 100
      : 0;

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
      <div
        className={`bg-gradient-to-r ${statusConfig.gradient} p-4`}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-white font-bold text-lg">
              {settlement.SettlementNumber}
            </h3>
            <p className="text-white/90 text-sm line-clamp-1">
              {settlement.PartnerName}
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
            <DollarSign className="w-4 h-4" />
            <span>{settlement.SalesReportIds.length} rapport(s)</span>
          </div>
          {settlement.PaymentDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date(settlement.PaymentDate).toLocaleDateString('fr-FR')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        {/* Montants */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
            <span className="text-xs text-gray-600">Total Dû</span>
            <p className="text-2xl font-bold text-purple-700 mt-1">
              {new Intl.NumberFormat('fr-FR').format(settlement.TotalDue)} F
            </p>
          </div>

          <div
            className={`rounded-xl p-4 ${
              settlement.AmountRemaining > 0
                ? 'bg-gradient-to-br from-orange-50 to-red-50'
                : 'bg-gradient-to-br from-green-50 to-emerald-50'
            }`}
          >
            <span className="text-xs text-gray-600">Restant</span>
            <p
              className={`text-2xl font-bold mt-1 ${
                settlement.AmountRemaining > 0
                  ? 'text-orange-700'
                  : 'text-green-700'
              }`}
            >
              {new Intl.NumberFormat('fr-FR').format(
                settlement.AmountRemaining
              )}{' '}
              F
            </p>
          </div>
        </div>

        {showDetails && (
          <>
            {/* Barre de progression paiement */}
            {settlement.Status === 'partial' || settlement.Status === 'completed' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Progression paiement
                  </span>
                  <span className="text-sm font-bold text-green-700">
                    {Math.round(paymentProgress)}%
                  </span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all rounded-full"
                    style={{ width: `${Math.min(paymentProgress, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                  <span>
                    Payé:{' '}
                    {new Intl.NumberFormat('fr-FR').format(
                      settlement.AmountPaid
                    )}{' '}
                    F
                  </span>
                  <span>
                    Total:{' '}
                    {new Intl.NumberFormat('fr-FR').format(settlement.TotalDue)}{' '}
                    F
                  </span>
                </div>
              </div>
            ) : null}

            {/* Mode de paiement */}
            {settlement.PaymentMethod && (
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Mode de paiement</span>
                  <div className="flex items-center gap-2">
                    <PaymentIcon className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-700">
                      {getPaymentMethodLabel(settlement.PaymentMethod)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Informations complémentaires */}
            <div className="border-t pt-3 space-y-2 text-sm">
              {settlement.PreparedById && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Préparé par</span>
                  <span className="font-semibold text-gray-900">
                    {settlement.PreparedById}
                  </span>
                </div>
              )}

              {settlement.PaidById && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Payé par</span>
                  <span className="font-semibold text-gray-900">
                    {settlement.PaidById}
                  </span>
                </div>
              )}

              {settlement.TransactionId && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Transaction</span>
                  <span className="font-mono text-xs font-semibold text-gray-900">
                    {settlement.TransactionId.slice(0, 12)}...
                  </span>
                </div>
              )}
            </div>

            {/* Statut complet */}
            {settlement.Status === 'completed' && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    Règlement terminé
                  </p>
                  <p className="text-xs text-green-700">
                    Paiement effectué le{' '}
                    {settlement.PaymentDate &&
                      new Date(settlement.PaymentDate).toLocaleDateString(
                        'fr-FR'
                      )}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Indicateur pour voir plus de détails */}
        {onClick && (
          <div className="flex items-center justify-center text-purple-600 pt-2">
            <DollarSign className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">Voir le règlement</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
