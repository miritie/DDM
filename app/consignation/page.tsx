'use client';

/**
 * Page - Dashboard Consignation & Partenaires (Mobile-First)
 * Vue d'ensemble complète du module de consignation
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Store,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Partner, Deposit } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  // Partenaires
  totalPartners: number;
  activePartners: number;

  // Dépôts
  activeDeposits: number;
  totalDepositedValue: number;

  // Financier
  totalSales: number;
  outstandingBalance: number;
  pendingSettlements: number;

  // Performance
  averageSalesRate: number;
  averageReturnRate: number;
}

interface QuickAction {
  icon: React.ElementType;
  label: string;
  description: string;
  href: string;
  color: string;
}

export default function ConsignationDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topPartners, setTopPartners] = useState<Partner[]>([]);
  const [recentDeposits, setRecentDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      // Charger les données en parallèle
      const [partnersRes, depositsRes] = await Promise.all([
        fetch('/api/consignation/partners'),
        fetch('/api/consignation/deposits'),
      ]);

      const partnersData = await partnersRes.json();
      const depositsData = await depositsRes.json();

      if (partnersRes.ok && depositsRes.ok) {
        const partners = partnersData.data || [];
        const deposits = depositsData.data || [];

        // Calculer les statistiques
        calculateStats(partners, deposits);

        // Top 5 partenaires par ventes
        const sortedBySales = [...partners].sort((a, b) => b.TotalSold - a.TotalSold);
        setTopPartners(sortedBySales.slice(0, 5));

        // 5 dépôts récents
        const sortedByDate = [...deposits].sort(
          (a, b) => new Date(b.DepositDate).getTime() - new Date(a.DepositDate).getTime()
        );
        setRecentDeposits(sortedByDate.slice(0, 5));
      }
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(partners: Partner[], deposits: Deposit[]) {
    const activeDeposits = deposits.filter(
      (d) => d.Status === 'validated' || d.Status === 'partial'
    );

    const totalDepositedValue = activeDeposits.reduce((sum, d) => sum + d.TotalValue, 0);

    // Taux moyens
    let totalSalesRate = 0;
    let totalReturnRate = 0;
    let depositsWithActivity = 0;

    activeDeposits.forEach((deposit) => {
      const totalDeposited = deposit.Lines.reduce((sum, l) => sum + l.QuantityDeposited, 0);
      const totalSold = deposit.Lines.reduce((sum, l) => sum + l.QuantitySold, 0);
      const totalReturned = deposit.Lines.reduce((sum, l) => sum + l.QuantityReturned, 0);

      if (totalDeposited > 0) {
        totalSalesRate += (totalSold / totalDeposited) * 100;
        totalReturnRate += (totalReturned / totalDeposited) * 100;
        depositsWithActivity++;
      }
    });

    setStats({
      totalPartners: partners.length,
      activePartners: partners.filter((p) => p.Status === 'active').length,
      activeDeposits: activeDeposits.length,
      totalDepositedValue,
      totalSales: partners.reduce((sum, p) => sum + p.TotalSold, 0),
      outstandingBalance: partners.reduce((sum, p) => sum + p.CurrentBalance, 0),
      pendingSettlements: partners.filter((p) => p.CurrentBalance > 0).length,
      averageSalesRate: depositsWithActivity > 0 ? totalSalesRate / depositsWithActivity : 0,
      averageReturnRate: depositsWithActivity > 0 ? totalReturnRate / depositsWithActivity : 0,
    });
  }

  const quickActions: QuickAction[] = [
    {
      icon: Store,
      label: 'Nouveau Partenaire',
      description: 'Ajouter un partenaire',
      href: '/consignation/partners/new',
      color: 'from-indigo-500 to-purple-600',
    },
    {
      icon: Package,
      label: 'Nouveau Dépôt',
      description: 'Créer un dépôt',
      href: '/consignation/deposits/new',
      color: 'from-blue-500 to-cyan-600',
    },
    {
      icon: FileText,
      label: 'Rapports de Ventes',
      description: 'Voir les rapports',
      href: '/consignation/sales-reports',
      color: 'from-green-500 to-emerald-600',
    },
    {
      icon: DollarSign,
      label: 'Règlements',
      description: 'Gérer les paiements',
      href: '/consignation/settlements',
      color: 'from-orange-500 to-red-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <Package className="w-7 h-7" />
            Consignation & Partenaires
          </h1>

          {/* KPIs Principaux */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Store className="w-5 h-5" />
                  <span className="text-sm opacity-90">Partenaires Actifs</span>
                </div>
                <p className="text-3xl font-bold">
                  {stats.activePartners}/{stats.totalPartners}
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-5 h-5" />
                  <span className="text-sm opacity-90">Dépôts Actifs</span>
                </div>
                <p className="text-3xl font-bold">{stats.activeDeposits}</p>
                <p className="text-xs opacity-80 mt-1">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                  }).format(stats.totalDepositedValue)}{' '}
                  F
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">Ventes Totales</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(stats.totalSales)}{' '}
                  F
                </p>
                <p className="text-xs opacity-80 mt-1">
                  Taux moyen: {Math.round(stats.averageSalesRate)}%
                </p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-sm opacity-90">Soldes Dus</span>
                </div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('fr-FR', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(stats.outstandingBalance)}{' '}
                  F
                </p>
                <p className="text-xs opacity-80 mt-1">
                  {stats.pendingSettlements} règlement{stats.pendingSettlements > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4 space-y-6">
        {/* Actions rapides */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold text-lg mb-4">Actions Rapides</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className={`bg-gradient-to-br ${action.color} text-white p-4 rounded-xl hover:scale-105 active:scale-95 transition-transform`}
              >
                <action.icon className="w-8 h-8 mb-2" />
                <p className="font-semibold text-sm">{action.label}</p>
                <p className="text-xs opacity-90 mt-1">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Top Partenaires */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Top Partenaires
            </h2>
            <button
              onClick={() => router.push('/consignation/partners')}
              className="text-indigo-600 font-medium text-sm flex items-center gap-1 hover:underline"
            >
              Voir tous
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {topPartners.length > 0 ? (
            <div className="space-y-3">
              {topPartners.map((partner, index) => (
                <div
                  key={partner.PartnerId}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => router.push(`/consignation/partners/${partner.PartnerId}`)}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{partner.Name}</p>
                    <p className="text-sm text-gray-600">{partner.PartnerCode}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-indigo-700">
                      {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(
                        partner.TotalSold
                      )}{' '}
                      F
                    </p>
                    {partner.CurrentBalance > 0 && (
                      <p className="text-xs text-red-600 font-semibold">
                        Dû: {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(
                          partner.CurrentBalance
                        )}{' '}
                        F
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Aucun partenaire</p>
          )}
        </div>

        {/* Dépôts récents */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Dépôts Récents
            </h2>
            <button
              onClick={() => router.push('/consignation/deposits')}
              className="text-indigo-600 font-medium text-sm flex items-center gap-1 hover:underline"
            >
              Voir tous
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {recentDeposits.length > 0 ? (
            <div className="space-y-3">
              {recentDeposits.map((deposit) => {
                const statusConfig = {
                  pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
                  validated: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100' },
                  partial: { icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-100' },
                  completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
                  cancelled: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
                }[deposit.Status];

                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={deposit.DepositId}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => router.push(`/consignation/deposits/${deposit.DepositId}`)}
                  >
                    <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
                      <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{deposit.DepositNumber}</p>
                      <p className="text-sm text-gray-600 truncate">{deposit.PartnerName}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-indigo-700">
                        {new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(
                          deposit.TotalValue
                        )}{' '}
                        F
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(deposit.DepositDate).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Aucun dépôt</p>
          )}
        </div>

        {/* Alertes */}
        {stats && stats.outstandingBalance > 100000 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 mb-1">Soldes élevés détectés</h3>
              <p className="text-sm text-red-700">
                Montant total à payer aux partenaires:{' '}
                <strong>
                  {new Intl.NumberFormat('fr-FR').format(stats.outstandingBalance)} F
                </strong>
                . {stats.pendingSettlements} règlement{stats.pendingSettlements > 1 ? 's' : ''} en
                attente.
              </p>
              <Button
                onClick={() => router.push('/consignation/settlements')}
                className="mt-3 bg-red-600 hover:bg-red-700 text-white h-10"
              >
                Gérer les règlements
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
