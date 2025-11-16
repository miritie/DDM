'use client';

/**
 * Page - Historique des Transactions
 * Module Trésorerie Multi-Wallet
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Transaction, Wallet } from '@/types/modules';
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Plus, Filter } from 'lucide-react';

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      // Load wallets
      const walletsRes = await fetch('/api/treasury/wallets?isActive=true');
      if (walletsRes.ok) {
        const walletsData = await walletsRes.json();
        setWallets(walletsData.data || []);
      }

      // Load transactions
      const params = filter !== 'all' ? `?type=${filter}` : '';
      const transactionsRes = await fetch(`/api/treasury/transactions${params}`);
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getWalletName(walletId?: string): string {
    if (!walletId) return '-';
    const wallet = wallets.find((w) => w.WalletId === walletId);
    return wallet?.Name || 'Inconnu';
  }

  function getTransactionIcon(type: string) {
    const icons = {
      income: <ArrowDownCircle className="h-5 w-5 text-green-600" />,
      expense: <ArrowUpCircle className="h-5 w-5 text-red-600" />,
      transfer: <ArrowRightLeft className="h-5 w-5 text-blue-600" />,
    };
    return icons[type as keyof typeof icons];
  }

  function getTransactionBadge(type: string) {
    const styles = {
      income: 'bg-green-100 text-green-800',
      expense: 'bg-red-100 text-red-800',
      transfer: 'bg-blue-100 text-blue-800',
    };
    const labels = {
      income: 'Revenu',
      expense: 'Dépense',
      transfer: 'Transfert',
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
          styles[type as keyof typeof styles]
        }`}
      >
        {getTransactionIcon(type)}
        {labels[type as keyof typeof labels]}
      </span>
    );
  }

  function getCategoryLabel(category: string) {
    const labels: Record<string, string> = {
      sales: 'Ventes',
      services: 'Services',
      salary: 'Salaires',
      supplies: 'Fournitures',
      rent: 'Loyer',
      utilities: 'Charges',
      marketing: 'Marketing',
      transport: 'Transport',
      maintenance: 'Maintenance',
      transfer: 'Transfert',
      other: 'Autre',
    };
    return labels[category] || category;
  }

  function getStatusBadge(status: string) {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels = {
      completed: 'Complété',
      pending: 'En attente',
      cancelled: 'Annulé',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  }

  const totals = {
    income: transactions.filter((t) => t.Type === 'income').reduce((sum, t) => sum + t.Amount, 0),
    expense: transactions.filter((t) => t.Type === 'expense').reduce((sum, t) => sum + t.Amount, 0),
    transfer: transactions.filter((t) => t.Type === 'transfer').reduce((sum, t) => sum + t.Amount, 0),
  };

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Transactions</h1>
            <p className="text-gray-600">Historique de toutes les opérations de trésorerie</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/treasury')}>
              Retour
            </Button>
            <Button onClick={() => router.push('/treasury/transactions/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Transaction
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4 text-green-600" />
                Revenus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.income)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.filter((t) => t.Type === 'income').length} transaction(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-red-600" />
                Dépenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.expense)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.filter((t) => t.Type === 'expense').length} transaction(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                Solde Net
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  totals.income - totals.expense >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(totals.income - totals.expense)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{transactions.length} transaction(s) totale(s)</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
                Toutes
              </Button>
              <Button
                variant={filter === 'income' ? 'default' : 'outline'}
                onClick={() => setFilter('income')}
                className="inline-flex items-center gap-2"
              >
                <ArrowDownCircle className="h-4 w-4" />
                Revenus
              </Button>
              <Button
                variant={filter === 'expense' ? 'default' : 'outline'}
                onClick={() => setFilter('expense')}
                className="inline-flex items-center gap-2"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Dépenses
              </Button>
              <Button
                variant={filter === 'transfer' ? 'default' : 'outline'}
                onClick={() => setFilter('transfer')}
                className="inline-flex items-center gap-2"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transferts
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Transactions</CardTitle>
            <CardDescription>{transactions.length} transaction(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">Aucune transaction trouvée</p>
                <Button onClick={() => router.push('/treasury/transactions/new')}>Créer une transaction</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Source/Destination
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <tr key={transaction.TransactionId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{transaction.TransactionNumber}</td>
                        <td className="px-4 py-3 text-sm">{getTransactionBadge(transaction.Type)}</td>
                        <td className="px-4 py-3 text-sm">{getCategoryLabel(transaction.Category)}</td>
                        <td className="px-4 py-3 text-sm">
                          {transaction.Type === 'income' && (
                            <span>→ {getWalletName(transaction.DestinationWalletId)}</span>
                          )}
                          {transaction.Type === 'expense' && (
                            <span>{getWalletName(transaction.SourceWalletId)} →</span>
                          )}
                          {transaction.Type === 'transfer' && (
                            <span>
                              {getWalletName(transaction.SourceWalletId)} → {getWalletName(transaction.DestinationWalletId)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{transaction.Description}</td>
                        <td
                          className={`px-4 py-3 text-sm text-right font-bold ${
                            transaction.Type === 'income'
                              ? 'text-green-600'
                              : transaction.Type === 'expense'
                                ? 'text-red-600'
                                : 'text-blue-600'
                          }`}
                        >
                          {transaction.Type === 'income' ? '+' : transaction.Type === 'expense' ? '-' : ''}
                          {formatCurrency(transaction.Amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{getStatusBadge(transaction.Status)}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(transaction.ProcessedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
