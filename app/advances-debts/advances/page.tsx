'use client';

/**
 * Page - Avances
 * Module Avances & Dettes
 * Suivi des avances accordées (agents, fournisseurs)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdvanceDebt, Account } from '@/types/modules';
import { HandCoins, Plus, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdvancesPage() {
  const router = useRouter();
  const [advances, setAdvances] = useState<AdvanceDebt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'partially_paid' | 'fully_paid'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      // Load accounts
      const accountsRes = await fetch('/api/accounts');
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.data || []);
      }

      // Load advances
      let url = '/api/advances-debts?type=advance';
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }
      const advancesRes = await fetch(url);
      if (advancesRes.ok) {
        const advancesData = await advancesRes.json();
        setAdvances(advancesData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getAccountName(accountId: string): string {
    const account = accounts.find((a) => a.AccountId === accountId);
    return account?.Name || 'Compte inconnu';
  }

  function getStatusBadge(status: string) {
    const styles = {
      active: 'bg-blue-100 text-blue-800',
      partially_paid: 'bg-yellow-100 text-yellow-800',
      fully_paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels = {
      active: 'Actif',
      partially_paid: 'Part. payé',
      fully_paid: 'Payé',
      cancelled: 'Annulé',
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}
      >
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
    }).format(new Date(dateString));
  }

  const totals = {
    total: advances.reduce((sum, a) => sum + a.Amount, 0),
    balance: advances.reduce((sum, a) => sum + a.Balance, 0),
    paid: advances.reduce((sum, a) => sum + (a.Amount - a.Balance), 0),
  };

  return (
    <ProtectedPage permission={PERMISSIONS.ADVANCE_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <HandCoins className="h-8 w-8 text-blue-600" />
              Avances
            </h1>
            <p className="text-gray-600">Suivi des avances accordées aux agents et fournisseurs</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/advances-debts')}>
              Retour
            </Button>
            <Button onClick={() => router.push('/advances-debts/new?type=advance')}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Avance
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Avances</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.total)}</p>
              <p className="text-xs text-gray-500 mt-1">{advances.length} avance(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                Solde Restant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totals.balance)}</p>
              <p className="text-xs text-gray-500 mt-1">À justifier/rembourser</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Justifié
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.paid)}</p>
              <p className="text-xs text-gray-500 mt-1">Justifications reçues</p>
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
                variant={filter === 'active' ? 'default' : 'outline'}
                onClick={() => setFilter('active')}
              >
                Actives
              </Button>
              <Button
                variant={filter === 'partially_paid' ? 'default' : 'outline'}
                onClick={() => setFilter('partially_paid')}
              >
                Partiellement justifiées
              </Button>
              <Button
                variant={filter === 'fully_paid' ? 'default' : 'outline'}
                onClick={() => setFilter('fully_paid')}
              >
                Entièrement justifiées
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Advances List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Avances</CardTitle>
            <CardDescription>{advances.length} avance(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : advances.length === 0 ? (
              <div className="text-center py-12">
                <HandCoins className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Aucune avance trouvée</p>
                <Button onClick={() => router.push('/advances-debts/new?type=advance')}>
                  Créer une avance
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Bénéficiaire
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motif</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Solde</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Échéance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {advances.map((advance) => (
                      <tr
                        key={advance.AdvanceDebtId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/advances-debts/${advance.AdvanceDebtId}`)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">{advance.RecordNumber}</td>
                        <td className="px-4 py-3 text-sm">{getAccountName(advance.AccountId)}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{advance.Reason}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                          {formatCurrency(advance.Amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-orange-600">
                          {formatCurrency(advance.Balance)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{getStatusBadge(advance.Status)}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(advance.CreatedAt)}</td>
                        <td className="px-4 py-3 text-sm">
                          {advance.DueDate ? formatDate(advance.DueDate) : '-'}
                        </td>
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
