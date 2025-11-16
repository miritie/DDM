'use client';

/**
 * Page - Détail Partenaire avec Onglets (Mobile-First)
 * 4 onglets: Informations, Dépôts, Rapports, Règlements
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Store,
  Phone,
  Mail,
  MapPin,
  Edit,
  Package,
  FileText,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Partner, Deposit, SalesReport, Settlement } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { DepositCard } from '@/components/consignation/deposit-card';
import { SalesReportCard } from '@/components/consignation/sales-report-card';
import { SettlementCard } from '@/components/consignation/settlement-card';

type TabType = 'info' | 'deposits' | 'reports' | 'settlements';

export default function PartnerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const partnerId = params.id as string;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [reports, setReports] = useState<SalesReport[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  useEffect(() => {
    loadData();
  }, [partnerId]);

  async function loadData() {
    try {
      setLoading(true);

      const [partnerRes, depositsRes, reportsRes, settlementsRes] =
        await Promise.all([
          fetch(`/api/consignation/partners/${partnerId}`),
          fetch(`/api/consignation/deposits?partnerId=${partnerId}`),
          fetch(`/api/consignation/sales-reports?partnerId=${partnerId}`),
          fetch(`/api/consignation/settlements?partnerId=${partnerId}`),
        ]);

      if (partnerRes.ok) {
        const partnerData = await partnerRes.json();
        setPartner(partnerData.data);
      }

      if (depositsRes.ok) {
        const depositsData = await depositsRes.json();
        setDeposits(depositsData.data || []);
      }

      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData.data || []);
      }

      if (settlementsRes.ok) {
        const settlementsData = await settlementsRes.json();
        setSettlements(settlementsData.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  }

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

  if (!partner) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Partenaire non trouvé</p>
          <Button
            onClick={() => router.push('/consignation/partners')}
            className="mt-4"
          >
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'info', label: 'Informations', icon: Store, count: null },
    { id: 'deposits', label: 'Dépôts', icon: Package, count: deposits.length },
    { id: 'reports', label: 'Rapports', icon: FileText, count: reports.length },
    {
      id: 'settlements',
      label: 'Règlements',
      icon: DollarSign,
      count: settlements.length,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-4 hover:opacity-80"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{partner.Name}</h1>
              <p className="text-sm opacity-90 mt-1">{partner.PartnerCode}</p>
            </div>

            <Button
              onClick={() =>
                router.push(`/consignation/partners/${partnerId}/edit`)
              }
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white h-10"
            >
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs opacity-90">Total Vendu</span>
              </div>
              <p className="text-xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  notation: 'compact',
                }).format(partner.TotalSold)}{' '}
                F
              </p>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs opacity-90">Solde</span>
              </div>
              <p className="text-xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  notation: 'compact',
                }).format(partner.CurrentBalance)}{' '}
                F
              </p>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <Package className="w-4 h-4" />
                <span className="text-xs opacity-90">Dépôts</span>
              </div>
              <p className="text-xl font-bold">{deposits.length}</p>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
              <div className="flex items-center gap-1 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs opacity-90">Rapports</span>
              </div>
              <p className="text-xl font-bold">{reports.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation onglets */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-4 px-4 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        activeTab === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu des onglets */}
        <div className="mt-6 space-y-4">
          {/* Onglet Informations */}
          {activeTab === 'info' && (
            <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6">
              {/* Contact */}
              <div>
                <h2 className="font-bold text-lg mb-4">Contact</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <Phone className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-xs text-gray-600">Téléphone</p>
                      <p className="font-semibold">{partner.Phone}</p>
                    </div>
                  </div>

                  {partner.Email && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Mail className="w-5 h-5 text-indigo-600" />
                      <div>
                        <p className="text-xs text-gray-600">Email</p>
                        <p className="font-semibold">{partner.Email}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <MapPin className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-600">Adresse</p>
                      <p className="font-semibold">
                        {[partner.Address, partner.City, partner.Region]
                          .filter(Boolean)
                          .join(', ') || 'Non renseignée'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contrat */}
              <div>
                <h2 className="font-bold text-lg mb-4">Contrat</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-purple-50 rounded-xl">
                    <p className="text-xs text-gray-600">Commission</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {partner.CommissionRate}%
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-xl">
                    <p className="text-xs text-gray-600">Règlement</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {partner.PaymentTerms} jours
                    </p>
                  </div>

                  <div className="p-3 bg-green-50 rounded-xl">
                    <p className="text-xs text-gray-600">Début</p>
                    <p className="font-semibold text-green-700">
                      {new Date(partner.ContractStartDate).toLocaleDateString(
                        'fr-FR'
                      )}
                    </p>
                  </div>

                  {partner.ContractEndDate && (
                    <div className="p-3 bg-orange-50 rounded-xl">
                      <p className="text-xs text-gray-600">Fin</p>
                      <p className="font-semibold text-orange-700">
                        {new Date(partner.ContractEndDate).toLocaleDateString(
                          'fr-FR'
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Alerte solde */}
              {partner.CurrentBalance > 50000 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-800">Solde élevé</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Règlement recommandé de{' '}
                      {new Intl.NumberFormat('fr-FR').format(
                        partner.CurrentBalance
                      )}{' '}
                      F
                    </p>
                    <Button
                      onClick={() =>
                        router.push('/consignation/settlements/new')
                      }
                      className="mt-3 bg-red-600 hover:bg-red-700 h-9"
                    >
                      Créer un règlement
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Onglet Dépôts */}
          {activeTab === 'deposits' && (
            <>
              {deposits.length > 0 ? (
                deposits.map((deposit) => (
                  <DepositCard
                    key={deposit.DepositId}
                    deposit={deposit}
                    onClick={() =>
                      router.push(`/consignation/deposits/${deposit.DepositId}`)
                    }
                    showDetails={true}
                  />
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl shadow">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Aucun dépôt</p>
                  <Button
                    onClick={() =>
                      router.push(
                        `/consignation/deposits/new?partnerId=${partnerId}`
                      )
                    }
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Créer un dépôt
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Onglet Rapports */}
          {activeTab === 'reports' && (
            <>
              {reports.length > 0 ? (
                reports.map((report) => (
                  <SalesReportCard
                    key={report.SalesReportId}
                    report={report}
                    onClick={() =>
                      router.push(
                        `/consignation/sales-reports/${report.SalesReportId}`
                      )
                    }
                    showDetails={true}
                  />
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl shadow">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun rapport de ventes</p>
                </div>
              )}
            </>
          )}

          {/* Onglet Règlements */}
          {activeTab === 'settlements' && (
            <>
              {settlements.length > 0 ? (
                settlements.map((settlement) => (
                  <SettlementCard
                    key={settlement.SettlementId}
                    settlement={settlement}
                    onClick={() =>
                      router.push(
                        `/consignation/settlements/${settlement.SettlementId}`
                      )
                    }
                    showDetails={true}
                  />
                ))
              ) : (
                <div className="text-center py-12 bg-white rounded-2xl shadow">
                  <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun règlement</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
