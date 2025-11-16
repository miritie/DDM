'use client';

/**
 * Composant - Card Client (Mobile-First)
 * Card tactile pour afficher les infos client principales
 */

import { Customer } from '@/types/modules';
import { Phone, Mail, MapPin, ShoppingBag, Star, TrendingUp, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CustomerCardProps {
  customer: Customer;
  onClick?: () => void;
  showDetails?: boolean;
  showActions?: boolean;
  onCall?: () => void;
  onNewSale?: () => void;
}

export function CustomerCard({
  customer,
  onClick,
  showDetails = true,
  showActions = false,
  onCall,
  onNewSale,
}: CustomerCardProps) {
  const getLoyaltyConfig = (tier: string) => {
    const configs = {
      bronze: { color: 'from-orange-400 to-orange-600', badge: 'bg-orange-100 text-orange-800', icon: '🥉' },
      silver: { color: 'from-gray-400 to-gray-600', badge: 'bg-gray-100 text-gray-800', icon: '🥈' },
      gold: { color: 'from-yellow-400 to-yellow-600', badge: 'bg-yellow-100 text-yellow-800', icon: '🥇' },
      platinum: { color: 'from-blue-400 to-blue-600', badge: 'bg-blue-100 text-blue-800', icon: '💎' },
      diamond: { color: 'from-purple-400 to-purple-600', badge: 'bg-purple-100 text-purple-800', icon: '💠' },
    };
    return configs[tier as keyof typeof configs] || configs.bronze;
  };

  const loyaltyConfig = getLoyaltyConfig(customer.LoyaltyTier);

  const getStatusBadge = (status: string) => {
    const statuses = {
      active: { label: 'Actif', color: 'bg-green-100 text-green-800' },
      inactive: { label: 'Inactif', color: 'bg-gray-100 text-gray-800' },
      suspended: { label: 'Suspendu', color: 'bg-red-100 text-red-800' },
      vip: { label: 'VIP', color: 'bg-purple-100 text-purple-800' },
    };
    return statuses[status as keyof typeof statuses] || statuses.active;
  };

  const statusBadge = getStatusBadge(customer.Status);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${
        onClick ? 'cursor-pointer hover:shadow-xl transition-all active:scale-98' : ''
      }`}
    >
      {/* Header avec gradient */}
      <div className={`bg-gradient-to-r ${loyaltyConfig.color} p-6 text-white`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-xl">{customer.FullName}</h3>
              <span className="text-2xl">{loyaltyConfig.icon}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={loyaltyConfig.badge}>
                {customer.LoyaltyTier.toUpperCase()}
              </Badge>
              <Badge className={statusBadge.color}>
                {statusBadge.label}
              </Badge>
            </div>
          </div>

          {/* Points */}
          <div className="text-right bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-bold text-2xl">{customer.LoyaltyPoints}</span>
            </div>
            <span className="text-xs opacity-90">points</span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-6">
        {/* Contact */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-gray-700">
            <Phone className="w-5 h-5 text-blue-600" />
            <a
              href={`tel:${customer.Phone}`}
              className="font-medium hover:text-blue-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {customer.Phone}
            </a>
          </div>

          {customer.Email && (
            <div className="flex items-center gap-3 text-gray-700">
              <Mail className="w-5 h-5 text-blue-600" />
              <a
                href={`mailto:${customer.Email}`}
                className="text-sm hover:text-blue-600 transition-colors truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {customer.Email}
              </a>
            </div>
          )}

          {customer.City && (
            <div className="flex items-center gap-3 text-gray-700">
              <MapPin className="w-5 h-5 text-blue-600" />
              <span className="text-sm">{customer.City}</span>
            </div>
          )}
        </div>

        {showDetails && (
          <>
            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-lg text-blue-600">
                    {customer.TotalOrders}
                  </span>
                </div>
                <span className="text-xs text-gray-600">Achats</span>
              </div>

              <div className="text-center p-3 bg-green-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-bold text-sm text-green-600">
                    {new Intl.NumberFormat('fr-FR', {
                      notation: 'compact',
                      compactDisplay: 'short',
                    }).format(customer.TotalSpent)}
                  </span>
                </div>
                <span className="text-xs text-gray-600">Total</span>
              </div>

              <div className="text-center p-3 bg-purple-50 rounded-xl">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="font-bold text-sm text-purple-600">
                    {new Intl.NumberFormat('fr-FR', {
                      notation: 'compact',
                      compactDisplay: 'short',
                    }).format(customer.AverageOrderValue)}
                  </span>
                </div>
                <span className="text-xs text-gray-600">Panier moy.</span>
              </div>
            </div>

            {/* Dernière visite */}
            {customer.LastVisit && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <Calendar className="w-4 h-4" />
                <span>
                  Dernière visite:{' '}
                  {formatDistanceToNow(new Date(customer.LastVisit), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        {showActions && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCall?.();
              }}
              className="px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              <span>Appeler</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onNewSale?.();
              }}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors active:scale-95 flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Vente</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
