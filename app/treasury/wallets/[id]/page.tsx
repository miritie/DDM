'use client';

/**
 * Page - Détails d'un Wallet
 * Module Trésorerie
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Transaction } from '@/types/modules';

export default function WalletDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    bankName: '',
    accountNumber: '',
  });

  // Statistics
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    transactionCount: 0,
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);

      // Fetch wallet details
      const walletRes = await fetch(`/api/treasury/wallets/${id}`);
      if (!walletRes.ok) throw new Error('Wallet non trouvé');
      const walletData = await walletRes.json();
      setWallet(walletData.data);

      // Fetch transactions for this wallet
      const transactionsRes = await fetch(`/api/treasury/transactions?walletId=${id}`);
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData.data || []);

        // Calculate statistics
        const income = transactionsData.data
          .filter((t: Transaction) => t.Type === 'income' && t.DestinationWalletId === id)
          .reduce((sum: number, t: Transaction) => sum + t.Amount, 0);

        const expense = transactionsData.data
          .filter((t: Transaction) => t.Type === 'expense' && t.SourceWalletId === id)
          .reduce((sum: number, t: Transaction) => sum + t.Amount, 0);

        const transferIn = transactionsData.data
          .filter((t: Transaction) => t.Type === 'transfer' && t.DestinationWalletId === id)
          .reduce((sum: number, t: Transaction) => sum + t.Amount, 0);

        const transferOut = transactionsData.data
          .filter((t: Transaction) => t.Type === 'transfer' && t.SourceWalletId === id)
          .reduce((sum: number, t: Transaction) => sum + t.Amount, 0);

        setStats({
          totalIncome: income + transferIn,
          totalExpense: expense + transferOut,
          transactionCount: transactionsData.data.length,
        });
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit() {
    try {
      const response = await fetch(`/api/treasury/wallets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Name: editForm.name,
          Description: editForm.description,
          BankName: editForm.bankName,
          AccountNumber: editForm.accountNumber,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la mise à jour');
      }

      alert('Wallet mis à jour avec succès');
      setShowEditModal(false);
      await loadData();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleDeactivate() {
    if (!confirm('Êtes-vous sûr de vouloir désactiver ce wallet?')) return;

    try {
      const response = await fetch(`/api/treasury/wallets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Status: 'inactive' }),
      });

      if (!response.ok) throw new Error('Erreur lors de la désactivation');

      alert('Wallet désactivé avec succès');
      await loadData();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleActivate() {
    try {
      const response = await fetch(`/api/treasury/wallets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Status: 'active' }),
      });

      if (!response.ok) throw new Error('Erreur lors de l\'activation');

      alert('Wallet activé avec succès');
      await loadData();
    } catch (error: any) {
      alert(error.message);
    }
  }

  function openEditModal() {
    setEditForm({
      name: wallet?.Name || '',
      description: wallet?.Description || '',
      bankName: wallet?.BankName || '',
      accountNumber: wallet?.AccountNumber || '',
    });
    setShowEditModal(true);
  }

  function getWalletIcon(type: string) {
    switch (type) {
      case 'cash':
        return '💵';
      case 'bank':
        return '🏦';
      case 'mobile_money':
        return '📱';
      default:
        return '💰';
    }
  }

  function getWalletTypeLabel(type: string) {
    const labels: Record<string, string> = {
      cash: 'Espèces',
      bank: 'Banque',
      mobile_money: 'Mobile Money',
      other: 'Autre',
    };
    return labels[type] || type;
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      closed: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      active: 'Actif',
      inactive: 'Inactif',
      closed: 'Fermé',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {labels[status] || status}
      </span>
    );
  }

  function formatCurrency(amount: number, currency: string = 'XOF') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
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

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
        <div className="p-8">
          <div className="text-center">Chargement...</div>
        </div>
      </ProtectedPage>
    );
  }

  if (!wallet) {
    return (
      <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
        <div className="p-8">
          <div className="text-center">Wallet non trouvé</div>
          <div className="text-center mt-4">
            <Button onClick={() => router.push('/treasury')}>Retour</Button>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="outline" onClick={() => router.push('/treasury')} className="mb-2">
              ← Retour
            </Button>
            <h1 className="text-3xl font-bold">
              {getWalletIcon(wallet.Type)} {wallet.Name}
            </h1>
            <p className="text-gray-600">Code: {wallet.Code}</p>
          </div>
          <div className="flex gap-2">
            {wallet.Status === 'active' ? (
              <>
                <Button onClick={openEditModal}>Modifier</Button>
                <Button variant="outline" onClick={handleDeactivate}>
                  Désactiver
                </Button>
              </>
            ) : wallet.Status === 'inactive' ? (
              <Button onClick={handleActivate}>Activer</Button>
            ) : null}
          </div>
        </div>

        {/* Wallet Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Informations du Wallet</CardTitle>
              {getStatusBadge(wallet.Status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-medium">{getWalletTypeLabel(wallet.Type)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Solde Actuel</p>
                <p className="font-bold text-2xl text-blue-600">
                  {formatCurrency(wallet.Balance, wallet.Currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Solde Initial</p>
                <p className="font-medium">{formatCurrency(wallet.InitialBalance, wallet.Currency)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Devise</p>
                <p className="font-medium">{wallet.Currency}</p>
              </div>
              {wallet.Type === 'bank' && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Banque</p>
                    <p className="font-medium">{wallet.BankName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Numéro de Compte</p>
                    <p className="font-medium">{wallet.AccountNumber || '-'}</p>
                  </div>
                </>
              )}
              {wallet.Description && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="font-medium">{wallet.Description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Entrées</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalIncome, wallet.Currency)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Sorties</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.totalExpense, wallet.Currency)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{stats.transactionCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions List */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des Transactions</CardTitle>
            <CardDescription>Toutes les transactions liées à ce wallet</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucune transaction</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((transaction) => {
                      const isIncoming =
                        transaction.Type === 'income' ||
                        (transaction.Type === 'transfer' && transaction.DestinationWalletId === id);
                      const amountColor = isIncoming ? 'text-green-600' : 'text-red-600';
                      const amountPrefix = isIncoming ? '+' : '-';

                      return (
                        <tr key={transaction.TransactionId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {formatDate(transaction.ProcessedAt || transaction.CreatedAt)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{transaction.TransactionNumber}</td>
                          <td className="px-4 py-3 text-sm">
                            {transaction.Type === 'income' && '💰 Revenu'}
                            {transaction.Type === 'expense' && '💸 Dépense'}
                            {transaction.Type === 'transfer' && '🔄 Transfert'}
                          </td>
                          <td className="px-4 py-3 text-sm">{transaction.Description}</td>
                          <td className={`px-4 py-3 text-sm font-bold text-right ${amountColor}`}>
                            {amountPrefix}
                            {formatCurrency(transaction.Amount, wallet.Currency)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            {transaction.Status === 'completed' && (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                Complété
                              </span>
                            )}
                            {transaction.Status === 'cancelled' && (
                              <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                                Annulé
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Modifier le Wallet</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                {wallet.Type === 'bank' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Banque</label>
                      <Input
                        value={editForm.bankName}
                        onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Numéro de Compte</label>
                      <Input
                        value={editForm.accountNumber}
                        onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 mt-6">
                <Button onClick={handleEdit} className="flex-1">
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
