'use client';

/**
 * Page - Détail Client avec Onglets (Mobile-First)
 * Vue complète du client avec Infos, Fidélité, Historique
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Edit,
  Star,
  History,
  TrendingUp,
  ShoppingBag,
  Award,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { Customer, LoyaltyTransaction } from '@/types/modules';
import { LoyaltyBadgeGradient, TierProgress } from '@/components/customers/loyalty-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

type TabType = 'info' | 'loyalty' | 'history' | 'interactions';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  useEffect(() => {
    loadCustomer();
    loadTransactions();
  }, [customerId]);

  const loadCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setCustomer(data.data);
      }
    } catch (error) {
      console.error('Erreur chargement client:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await fetch(`/api/customers/loyalty/transactions?customerId=${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
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

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Client non trouvé</p>
          <Button onClick={() => router.push('/customers')} className="mt-4">
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header avec infos client */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          {/* Navigation */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-4 hover:opacity-80"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          {/* Infos principales */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{customer.FullName}</h1>
                  <p className="text-sm opacity-90">{customer.CustomerCode}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap mt-3">
                <LoyaltyBadgeGradient tier={customer.LoyaltyTier} size="md" />
                {customer.Status === 'vip' && (
                  <Badge className="bg-yellow-400 text-yellow-900">VIP</Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => router.push(`/customers/${customerId}/edit`)}
                variant="outline"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-10"
              >
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            </div>
          </div>

          {/* KPIs rapides */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <Star className="w-5 h-5 mx-auto mb-1" />
              <p className="text-2xl font-bold">{customer.LoyaltyPoints}</p>
              <p className="text-xs opacity-90">Points</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <ShoppingBag className="w-5 h-5 mx-auto mb-1" />
              <p className="text-2xl font-bold">{customer.TotalOrders}</p>
              <p className="text-xs opacity-90">Achats</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-1" />
              <p className="text-xl font-bold">
                {new Intl.NumberFormat('fr-FR', {
                  notation: 'compact',
                  compactDisplay: 'short',
                }).format(customer.TotalSpent)}
              </p>
              <p className="text-xs opacity-90">CA Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-t-2xl shadow-xl overflow-hidden">
          {/* Navigation onglets */}
          <div className="flex border-b overflow-x-auto">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 min-w-[120px] px-4 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'info'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Infos</span>
            </button>
            <button
              onClick={() => setActiveTab('loyalty')}
              className={`flex-1 min-w-[120px] px-4 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'loyalty'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Fidélité</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 min-w-[120px] px-4 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Historique</span>
            </button>
            <button
              onClick={() => setActiveTab('interactions')}
              className={`flex-1 min-w-[120px] px-4 py-4 font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'interactions'
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Interactions</span>
            </button>
          </div>

          {/* Contenu des onglets */}
          <div className="p-6">
            {/* Onglet Infos */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                {/* Informations de contact */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">Contact</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Phone className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Téléphone</p>
                        <a
                          href={`tel:${customer.Phone}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {customer.Phone}
                        </a>
                      </div>
                    </div>

                    {customer.Email && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <Mail className="w-5 h-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Email</p>
                          <a
                            href={`mailto:${customer.Email}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {customer.Email}
                          </a>
                        </div>
                      </div>
                    )}

                    {customer.City && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <MapPin className="w-5 h-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Ville</p>
                          <p className="font-medium">{customer.City}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Statistiques */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">Statistiques</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Total Achats</p>
                      <p className="text-2xl font-bold text-blue-600">{customer.TotalOrders}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">CA Total</p>
                      <p className="text-2xl font-bold text-green-600">
                        {new Intl.NumberFormat('fr-FR').format(customer.TotalSpent)} F
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Panier Moyen</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {new Intl.NumberFormat('fr-FR').format(customer.AverageOrderValue)} F
                      </p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-xl">
                      <p className="text-sm text-gray-600 mb-1">Dernier Achat</p>
                      <p className="text-sm font-bold text-orange-600">
                        {customer.LastOrderDate
                          ? formatDistanceToNow(new Date(customer.LastOrderDate), {
                              addSuffix: true,
                              locale: fr,
                            })
                          : 'Jamais'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Préférences */}
                {customer.PreferredPaymentMethod && (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Préférences</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-600">Mode de paiement préféré</span>
                        <Badge>{customer.PreferredPaymentMethod}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-600">Recevoir les promotions</span>
                        <Badge variant={customer.ReceivePromotions ? 'default' : 'secondary'}>
                          {customer.ReceivePromotions ? 'Oui' : 'Non'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {customer.Notes && (
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Notes</h3>
                    <p className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-gray-700">
                      {customer.Notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <Button
                    onClick={() => (window.location.href = `tel:${customer.Phone}`)}
                    className="bg-green-600 hover:bg-green-700 h-12"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Appeler
                  </Button>
                  <Button
                    onClick={() => router.push(`/sales/new?customerId=${customerId}`)}
                    className="bg-blue-600 hover:bg-blue-700 h-12"
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Nouvelle Vente
                  </Button>
                </div>
              </div>
            )}

            {/* Onglet Fidélité */}
            {activeTab === 'loyalty' && (
              <div className="space-y-6">
                {/* Tier actuel */}
                <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl">
                  <p className="text-sm text-gray-600 mb-3">Niveau actuel</p>
                  <LoyaltyBadgeGradient tier={customer.LoyaltyTier} size="lg" />
                  <div className="mt-6 flex items-center justify-center gap-8">
                    <div>
                      <p className="text-3xl font-bold text-blue-600">
                        {customer.LoyaltyPoints}
                      </p>
                      <p className="text-sm text-gray-600">Points disponibles</p>
                    </div>
                    <div className="h-12 w-px bg-gray-300"></div>
                    <div>
                      <p className="text-3xl font-bold text-green-600">
                        {customer.TotalPointsEarned}
                      </p>
                      <p className="text-sm text-gray-600">Points gagnés</p>
                    </div>
                  </div>
                </div>

                {/* Progression */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">Progression</h3>
                  <TierProgress
                    currentTier={customer.LoyaltyTier}
                    currentPoints={customer.LoyaltyPoints}
                    currentSpent={customer.TotalSpent}
                  />
                </div>

                {/* Historique des points */}
                <div>
                  <h3 className="font-semibold text-lg mb-4">Historique des points</h3>
                  {transactions.length > 0 ? (
                    <div className="space-y-2">
                      {transactions.slice(0, 10).map((transaction) => (
                        <div
                          key={transaction.TransactionId}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{transaction.Description}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(transaction.CreatedAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <div
                            className={`text-lg font-bold ${
                              transaction.Points > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.Points > 0 ? '+' : ''}
                            {transaction.Points}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">
                      Aucune transaction de points
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Onglet Historique */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Historique des achats</h3>
                <p className="text-center text-gray-500 py-12">
                  L'historique des ventes sera affiché ici
                </p>
              </div>
            )}

            {/* Onglet Interactions */}
            {activeTab === 'interactions' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Interactions clients</h3>
                <p className="text-center text-gray-500 py-12">
                  Les interactions seront affichées ici
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
