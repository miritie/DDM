'use client';

/**
 * Page - Dashboard Fidélité (Mobile-First)
 * Vue d'ensemble du programme de fidélité
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  Star,
  Users,
  TrendingUp,
  Gift,
  Crown,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { LoyaltyReward, Customer } from '@/types/modules';
import { LoyaltyBadge } from '@/components/customers/loyalty-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LoyaltyStatistics {
  totalPoints: number;
  totalCustomers: number;
  pointsRedeemed: number;
  rewardsAvailable: number;
  byTier: Record<string, number>;
}

export default function LoyaltyDashboardPage() {
  const router = useRouter();
  const [statistics, setStatistics] = useState<LoyaltyStatistics | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [topCustomers, setTopCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Charger les statistiques clients
      const statsResponse = await fetch('/api/customers/statistics');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStatistics({
          totalPoints: statsData.data.totalLoyaltyPoints || 0,
          totalCustomers: statsData.data.totalCustomers || 0,
          pointsRedeemed: 0,
          rewardsAvailable: 0,
          byTier: statsData.data.customersByTier || {},
        });
      }

      // Charger les récompenses
      const rewardsResponse = await fetch('/api/customers/loyalty/rewards');
      if (rewardsResponse.ok) {
        const rewardsData = await rewardsResponse.json();
        setRewards(rewardsData.data || []);
      }

      // Charger les top clients
      const topResponse = await fetch('/api/customers/top?limit=5');
      if (topResponse.ok) {
        const topData = await topResponse.json();
        setTopCustomers(topData.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.push('/customers')}
            className="flex items-center gap-2 mb-4 hover:opacity-80"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Programme de Fidélité</h1>
              <p className="text-sm opacity-90">Vue d'ensemble et statistiques</p>
            </div>
          </div>

          {/* KPIs */}
          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-5 h-5" />
                  <span className="text-sm opacity-90">Points Totaux</span>
                </div>
                <p className="text-3xl font-bold">
                  {new Intl.NumberFormat('fr-FR').format(statistics.totalPoints)}
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-5 h-5" />
                  <span className="text-sm opacity-90">Membres</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalCustomers}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-5 h-5" />
                  <span className="text-sm opacity-90">Récompenses</span>
                </div>
                <p className="text-3xl font-bold">{rewards.length}</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Crown className="w-5 h-5" />
                  <span className="text-sm opacity-90">Tiers Actifs</span>
                </div>
                <p className="text-3xl font-bold">5</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4 space-y-6">
        {/* Distribution par tier */}
        {statistics && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Distribution par Niveau
            </h2>

            <div className="space-y-3">
              {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const).map((tier) => {
                const count = statistics.byTier[tier] || 0;
                const percentage =
                  statistics.totalCustomers > 0
                    ? (count / statistics.totalCustomers) * 100
                    : 0;

                return (
                  <div key={tier}>
                    <div className="flex items-center justify-between mb-2">
                      <LoyaltyBadge tier={tier} size="sm" />
                      <span className="text-sm font-semibold">
                        {count} clients ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Récompenses disponibles */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600" />
              Récompenses Disponibles
            </h2>
            <Badge>{rewards.length}</Badge>
          </div>

          {rewards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewards.slice(0, 6).map((reward) => (
                <div
                  key={reward.RewardId}
                  className="p-4 border-2 border-gray-100 rounded-xl hover:border-purple-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold">{reward.Name}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {reward.Description}
                      </p>
                    </div>
                    {reward.MinimumTier && (
                      <LoyaltyBadge tier={reward.MinimumTier} size="sm" showLabel={false} />
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1 text-purple-600 font-bold">
                      <Star className="w-4 h-4 fill-current" />
                      <span>{reward.PointsCost} pts</span>
                    </div>
                    <Badge
                      variant={reward.Status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {reward.Status === 'active' ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              Aucune récompense configurée
            </p>
          )}
        </div>

        {/* Top clients fidèles */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Top Clients Fidèles
          </h2>

          {topCustomers.length > 0 ? (
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div
                  key={customer.CustomerId}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => router.push(`/customers/${customer.CustomerId}`)}
                >
                  {/* Rang */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{customer.FullName}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {customer.LoyaltyPoints} pts
                      </span>
                      <span>{customer.TotalOrders} achats</span>
                    </div>
                  </div>

                  {/* Tier */}
                  <LoyaltyBadge tier={customer.LoyaltyTier} size="sm" showLabel={false} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Aucun client</p>
          )}
        </div>

        {/* Tiers Configuration (Aperçu) */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-xl p-6 border-2 border-purple-100">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-purple-600" />
            Niveaux de Fidélité
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const).map((tier) => {
              const thresholds = {
                bronze: '0 F',
                silver: '500K F',
                gold: '1M F',
                platinum: '2M F',
                diamond: '5M F',
              };

              return (
                <div key={tier} className="bg-white rounded-xl p-4 text-center">
                  <LoyaltyBadge tier={tier} size="md" />
                  <p className="text-xs text-gray-600 mt-2">À partir de</p>
                  <p className="font-bold text-sm">{thresholds[tier]}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-4 bg-white rounded-xl border border-purple-200">
            <p className="text-sm text-gray-700">
              <strong>Taux de gain de points :</strong> 1 point pour chaque 1000 F dépensés
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <strong>Avantages :</strong> Remises exclusives, points bonus, accès prioritaire
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
