/**
 * Page - Trésorerie Multi-wallet
 * Module 7.3
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Wallet, Transaction, TreasuryStatistics } from '@/types/modules';

export default function TreasuryPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [statistics, setStatistics] = React.useState<TreasuryStatistics | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  React.useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    setLoading(true);
    try {
      // Charger les wallets
      const walletsResponse = await fetch('/api/treasury/wallets?isActive=true');
      const walletsData = await walletsResponse.json();
      setWallets(walletsData.data || []);

      // Charger les transactions
      const params = filter !== 'all' ? `?type=${filter}` : '';
      const transactionsResponse = await fetch(`/api/treasury/transactions${params}`);
      const transactionsData = await transactionsResponse.json();
      setTransactions(transactionsData.data || []);

      // Charger les statistiques
      const statsResponse = await fetch('/api/treasury/statistics');
      const statsData = await statsResponse.json();
      setStatistics(statsData.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  }

  function getWalletIcon(type: string) {
    const icons: Record<string, string> = {
      cash: '💵',
      bank: '🏦',
      mobile_money: '📱',
      other: '💰',
    };
    return icons[type] || '💰';
  }

  function getTransactionTypeColor(type: string) {
    const colors: Record<string, string> = {
      income: 'text-green-600',
      expense: 'text-red-600',
      transfer: 'text-blue-600',
    };
    return colors[type] || 'text-gray-600';
  }

  function getTransactionSign(type: string) {
    return type === 'income' ? '+' : type === 'expense' ? '-' : '→';
  }

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Trésorerie Multi-wallet</h1>
            <p className="mt-1 text-gray-500">
              Module 7.3 - Gestion de la trésorerie
            </p>
          </div>
          <div className="flex gap-2">
            <Can permission={PERMISSIONS.TREASURY_CREATE}>
              <Button onClick={() => router.push('/treasury/wallets/new')} variant="outline">
                Nouveau wallet
              </Button>
              <Button onClick={() => router.push('/treasury/transactions/new')}>
                Nouvelle transaction
              </Button>
            </Can>
          </div>
        </div>

        {/* Statistiques Globales */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Solde total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(statistics.totalBalance)}</div>
                <p className="text-xs text-gray-500 mt-1">{statistics.walletsCount} wallets actifs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Revenus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(statistics.totalIncome)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Encaissements</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Dépenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(statistics.totalExpense)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Décaissements</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Transferts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(statistics.totalTransfers)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Mouvements internes</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Wallets */}
        <Card>
          <CardHeader>
            <CardTitle>Wallets</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Chargement...</div>
            ) : wallets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun wallet actif
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.WalletId}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/treasury/wallets/${wallet.WalletId}`)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getWalletIcon(wallet.Type)}</span>
                      <div className="flex-grow">
                        <div className="font-medium">{wallet.Name}</div>
                        <div className="text-xs text-gray-500">{wallet.Code}</div>
                      </div>
                    </div>
                    <div className="text-xl font-bold">{formatCurrency(wallet.Balance)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtres Transactions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Tout
          </button>
          <button
            onClick={() => setFilter('income')}
            className={`px-4 py-2 rounded ${filter === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Revenus
          </button>
          <button
            onClick={() => setFilter('expense')}
            className={`px-4 py-2 rounded ${filter === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Dépenses
          </button>
          <button
            onClick={() => setFilter('transfer')}
            className={`px-4 py-2 rounded ${filter === 'transfer' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Transferts
          </button>
        </div>

        {/* Transactions Récentes */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Chargement...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune transaction trouvée
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 10).map((transaction) => (
                  <div
                    key={transaction.TransactionId}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-grow">
                      <div className="font-medium">{transaction.Description}</div>
                      <div className="text-sm text-gray-500">
                        {transaction.TransactionNumber} • {formatDate(transaction.ProcessedAt)}
                      </div>
                    </div>

                    <div className={`text-xl font-bold ${getTransactionTypeColor(transaction.Type)}`}>
                      {getTransactionSign(transaction.Type)} {formatCurrency(transaction.Amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
