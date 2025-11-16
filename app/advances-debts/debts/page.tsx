'use client';

/**
 * Page - Dettes
 * Module Avances & Dettes
 * Suivi des dettes à payer (fournisseurs, partenaires)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdvanceDebt, Account } from '@/types/modules';
import { CreditCard, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DebtsPage() {
  const router = useRouter();
  const [debts, setDebts] = useState<AdvanceDebt[]>([]);
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

      // Load debts
      let url = '/api/advances-debts?type=debt';
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }
      const debtsRes = await fetch(url);
      if (debtsRes.ok) {
        const debtsData = await debtsRes.json();
        setDebts(debtsData.data || []);
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
      active: 'bg-red-100 text-red-800',
      partially_paid: 'bg-orange-100 text-orange-800',
      fully_paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      active: 'À payer',
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

  function isOverdue(debt: AdvanceDebt): boolean {
    if (!debt.DueDate || debt.Status === 'fully_paid' || debt.Status === 'cancelled') {
      return false;
    }
    return new Date(debt.DueDate) < new Date();
  }

  const totals = {
    total: debts.reduce((sum, d) => sum + d.Amount, 0),
    balance: debts.reduce((sum, d) => sum + d.Balance, 0),
    paid: debts.reduce((sum, d) => sum + (d.Amount - d.Balance), 0),
  };

  const overdueDebts = debts.filter((d) => isOverdue(d));

  return (
    <ProtectedPage permission={PERMISSIONS.ADVANCE_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CreditCard className="h-8 w-8 text-red-600" />
              Dettes
            </h1>
            <p className="text-gray-600">Suivi des dettes à payer aux fournisseurs et partenaires</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/advances-debts')}>
              Retour
            </Button>
            <Button onClick={() => router.push('/advances-debts/new?type=debt')}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Dette
            </Button>
          </div>
        </div>

        {/* Alert for overdue debts */}
        {overdueDebts.length > 0 && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">
                    {overdueDebts.length} dette(s) en retard de paiement
                  </p>
                  <p className="text-sm text-red-700">
                    Total en retard: {formatCurrency(overdueDebts.reduce((sum, d) => sum + d.Balance, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Dettes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.total)}</p>
              <p className="text-xs text-gray-500 mt-1">{debts.length} dette(s)</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Solde Restant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totals.balance)}</p>
              <p className="text-xs text-gray-500 mt-1">À payer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Déjà Payé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.paid)}</p>
              <p className="text-xs text-gray-500 mt-1">Paiements effectués</p>
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
                À payer
              </Button>
              <Button
                variant={filter === 'partially_paid' ? 'default' : 'outline'}
                onClick={() => setFilter('partially_paid')}
              >
                Partiellement payées
              </Button>
              <Button
                variant={filter === 'fully_paid' ? 'default' : 'outline'}
                onClick={() => setFilter('fully_paid')}
              >
                Entièrement payées
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Debts List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Dettes</CardTitle>
            <CardDescription>{debts.length} dette(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : debts.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Aucune dette trouvée</p>
                <Button onClick={() => router.push('/advances-debts/new?type=debt')}>Créer une dette</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Créancier
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
                    {debts.map((debt) => (
                      <tr
                        key={debt.AdvanceDebtId}
                        className={`hover:bg-gray-50 cursor-pointer ${isOverdue(debt) ? 'bg-red-50' : ''}`}
                        onClick={() => router.push(`/advances-debts/${debt.AdvanceDebtId}`)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          {debt.RecordNumber}
                          {isOverdue(debt) && (
                            <span className="ml-2">
                              <AlertTriangle className="h-4 w-4 inline text-red-600" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{getAccountName(debt.AccountId)}</td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">{debt.Reason}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                          {formatCurrency(debt.Amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-orange-600">
                          {formatCurrency(debt.Balance)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{getStatusBadge(debt.Status)}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(debt.CreatedAt)}</td>
                        <td className="px-4 py-3 text-sm">
                          {debt.DueDate ? (
                            <span className={isOverdue(debt) ? 'text-red-600 font-semibold' : ''}>
                              {formatDate(debt.DueDate)}
                            </span>
                          ) : (
                            '-'
                          )}
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
