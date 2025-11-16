/**
 * Composant - PartnerCard (Mobile-First)
 * Carte interactive pour afficher un partenaire de consignation
 */

'use client';

import { Partner, PartnerType } from '@/types/modules';
import {
  Store,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  DollarSign,
  Calendar,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PartnerCardProps {
  partner: Partner;
  onClick?: () => void;
  showDetails?: boolean;
  showActions?: boolean;
  onCall?: () => void;
  onNewDeposit?: () => void;
}

/**
 * Icône selon le type de partenaire
 */
const getPartnerIcon = (type: PartnerType) => {
  const icons = {
    pharmacy: '💊',
    relay_point: '📍',
    wholesaler: '🏪',
    retailer: '🛒',
    other: '🏢',
  };
  return icons[type] || '🏢';
};

/**
 * Label selon le type
 */
const getPartnerTypeLabel = (type: PartnerType) => {
  const labels = {
    pharmacy: 'Pharmacie',
    relay_point: 'Point Relais',
    wholesaler: 'Grossiste',
    retailer: 'Détaillant',
    other: 'Autre',
  };
  return labels[type] || 'Autre';
};

/**
 * Configuration du badge de statut
 */
const getStatusConfig = (status: string) => {
  const configs = {
    active: {
      color: 'bg-green-100 text-green-800 border-green-200',
      label: 'Actif',
      dot: 'bg-green-500',
    },
    inactive: {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      label: 'Inactif',
      dot: 'bg-gray-500',
    },
    suspended: {
      color: 'bg-red-100 text-red-800 border-red-200',
      label: 'Suspendu',
      dot: 'bg-red-500',
    },
    pending: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'En attente',
      dot: 'bg-yellow-500',
    },
  };
  return configs[status as keyof typeof configs] || configs.pending;
};

export function PartnerCard({
  partner,
  onClick,
  showDetails = true,
  showActions = false,
  onCall,
  onNewDeposit,
}: PartnerCardProps) {
  const statusConfig = getStatusConfig(partner.Status);

  // Déterminer si le partenaire a un solde en retard
  const hasOutstandingBalance = partner.CurrentBalance > 0;

  return (
    <div
      className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all ${
        onClick ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]' : ''
      }`}
      onClick={onClick}
    >
      {/* Header avec type et statut */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{getPartnerIcon(partner.Type)}</span>
            <div>
              <h3 className="text-white font-bold text-lg line-clamp-1">
                {partner.Name}
              </h3>
              <p className="text-white/90 text-sm">{partner.PartnerCode}</p>
            </div>
          </div>

          <div className={`px-3 py-1 rounded-full border-2 ${statusConfig.color} flex items-center gap-1.5`}>
            <div className={`w-2 h-2 rounded-full ${statusConfig.dot} animate-pulse`} />
            <span className="text-xs font-semibold">{statusConfig.label}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-white/90 text-sm">
          <Store className="w-4 h-4" />
          <span>{getPartnerTypeLabel(partner.Type)}</span>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4 space-y-3">
        {/* Contact */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-700">
            <Phone className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium">{partner.Phone}</span>
          </div>

          {partner.Email && (
            <div className="flex items-center gap-2 text-gray-700">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span className="text-sm truncate">{partner.Email}</span>
            </div>
          )}

          {(partner.City || partner.Address) && (
            <div className="flex items-start gap-2 text-gray-700">
              <MapPin className="w-4 h-4 text-indigo-600 mt-0.5" />
              <span className="text-sm line-clamp-2">
                {[partner.Address, partner.City].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Détails financiers */}
        {showDetails && (
          <>
            <div className="border-t pt-3 grid grid-cols-2 gap-3">
              <div className="bg-indigo-50 rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs text-gray-600">Total Vendu</span>
                </div>
                <p className="font-bold text-indigo-700 text-base">
                  {new Intl.NumberFormat('fr-FR').format(partner.TotalSold)} {partner.Currency}
                </p>
              </div>

              <div className={`rounded-xl p-3 ${
                hasOutstandingBalance ? 'bg-red-50' : 'bg-green-50'
              }`}>
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className={`w-3.5 h-3.5 ${
                    hasOutstandingBalance ? 'text-red-600' : 'text-green-600'
                  }`} />
                  <span className="text-xs text-gray-600">Solde Actuel</span>
                </div>
                <p className={`font-bold text-base ${
                  hasOutstandingBalance ? 'text-red-700' : 'text-green-700'
                }`}>
                  {new Intl.NumberFormat('fr-FR').format(partner.CurrentBalance)} {partner.Currency}
                </p>
              </div>
            </div>

            {/* Commission */}
            <div className="bg-purple-50 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Taux de commission</span>
                <span className="font-bold text-purple-700">{partner.CommissionRate}%</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-gray-700">Règlement</span>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                  <span className="font-semibold text-purple-700">{partner.PaymentTerms} jours</span>
                </div>
              </div>
            </div>

            {/* Alerte si solde élevé */}
            {hasOutstandingBalance && partner.CurrentBalance > 50000 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Solde élevé</p>
                  <p className="text-xs text-red-700">Règlement recommandé</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions rapides */}
        {showActions && (
          <div className="flex gap-2 pt-2">
            {onCall && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCall();
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <Phone className="w-4 h-4" />
                <span>Appeler</span>
              </button>
            )}

            {onNewDeposit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNewDeposit();
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <Store className="w-4 h-4" />
                <span>Dépôt</span>
              </button>
            )}
          </div>
        )}

        {/* Indicateur pour voir plus de détails */}
        {onClick && (
          <div className="flex items-center justify-center text-indigo-600 pt-2">
            <span className="text-sm font-medium">Voir les détails</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}
