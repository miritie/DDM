'use client';

/**
 * Page - Liste des Avances & Dettes
 * Module 7.5
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { AdvanceDebt } from '@/types/modules';

export default function AdvancesDebtsPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [advancesDebts, setAdvancesDebts] = React.useState<AdvanceDebt[]>([]);
  const [filter, setFilter] = React.useState<'all' | 'advance' | 'debt'>('all');
  const [statistics, setStatistics] = React.useState<any>(null);

  React.useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    setLoading(true);
    try {
      // Charger les avances/dettes
      const params = filter !== 'all' ? `?type=${filter}` : '';
      const response = await fetch(`/api/advances-debts${params}`);
      const data = await response.json();
      setAdvancesDebts(data.data || []);

      // Charger les statistiques
      const statsResponse = await fetch('/api/advances-debts/statistics');
      const statsData = await statsResponse.json();
      setStatistics(statsData.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const colors: Record<string, string> = {
      active: 'bg-blue-100 text-blue-800',
      partially_paid: 'bg-yellow-100 text-yellow-800',
      fully_paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    const labels: Record<string, string> = {
      active: 'Actif',
      partially_paid: 'Partiellement payé',
      fully_paid: 'Entièrement payé',
      cancelled: 'Annulé',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${colors[status] || colors.active}`}>
        {labels[status] || status}
      </span>
    );
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
    }).format(new Date(dateString));
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADVANCE_VIEW}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Avances & Dettes</h1>
            <p className="mt-1 text-gray-500">
              Module 7.5 - Gestion des avances et dettes
            </p>
          </div>
          <Can permission={PERMISSIONS.ADVANCE_CREATE}>
            <Button onClick={() => router.push('/advances-debts/new')}>
              Nouvelle avance/dette
            </Button>
          </Can>
        </div>

        {/* Statistiques */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Avances actives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.activeAdvances}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatCurrency(statistics.totalAdvanceBalance)} en cours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Dettes actives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.activeDebts}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatCurrency(statistics.totalDebtBalance)} en cours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Total avances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(statistics.totalAdvanceAmount)}
                </div>
                <p className="text-xs text-gray-500 mt-1">{statistics.totalAdvances} enregistrées</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Total dettes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(statistics.totalDebtAmount)}
                </div>
                <p className="text-xs text-gray-500 mt-1">{statistics.totalDebts} enregistrées</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtres */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Tout
          </button>
          <button
            onClick={() => setFilter('advance')}
            className={`px-4 py-2 rounded ${filter === 'advance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Avances
          </button>
          <button
            onClick={() => setFilter('debt')}
            className={`px-4 py-2 rounded ${filter === 'debt' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Dettes
          </button>
        </div>

        {/* Liste */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filter === 'all' && 'Toutes les avances & dettes'}
              {filter === 'advance' && 'Avances'}
              {filter === 'debt' && 'Dettes'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : advancesDebts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun enregistrement trouvé
              </div>
            ) : (
              <div className="space-y-3">
                {advancesDebts.map((item) => (
                  <div
                    key={item.AdvanceDebtId}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/advances-debts/${item.AdvanceDebtId}`)}
                  >
                    <div className="flex-grow">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {item.Type === 'advance' ? '💸' : '📋'}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900">
                            {item.RecordNumber} - {item.Reason}
                          </div>
                          <div className="text-sm text-gray-500">
                            Créé le {formatDate(item.CreatedAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Montant</div>
                        <div className="font-medium">{formatCurrency(item.Amount)}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-gray-500">Reste à payer</div>
                        <div className="font-medium">{formatCurrency(item.Balance)}</div>
                      </div>

                      <div>{getStatusBadge(item.Status)}</div>
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
