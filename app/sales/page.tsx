'use client';

/**
 * Page - Liste des Ventes
 * Module Ventes & Encaissements
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sale, SalesStatistics } from '@/types/modules';

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [statistics, setStatistics] = useState<SalesStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'draft' | 'fully_paid' | 'unpaid'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      // Load statistics
      const statsRes = await fetch('/api/sales/statistics');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.data);
      }

      // Load sales
      const params = new URLSearchParams();
      if (filter === 'confirmed' || filter === 'draft') {
        params.append('status', filter);
      } else if (filter === 'fully_paid' || filter === 'unpaid') {
        params.append('paymentStatus', filter);
      }

      const salesRes = await fetch(`/api/sales?${params.toString()}`);
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setSales(salesData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
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
    }).format(new Date(dateString));
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      fully_paid: 'bg-green-100 text-green-800',
      partially_paid: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      draft: 'Brouillon',
      confirmed: 'Confirmée',
      fully_paid: 'Payée',
      partially_paid: 'Partiellement payée',
      cancelled: 'Annulée',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  }

  function getPaymentStatusBadge(status: string) {
    const styles: Record<string, string> = {
      unpaid: 'bg-red-100 text-red-800',
      partially_paid: 'bg-yellow-100 text-yellow-800',
      fully_paid: 'bg-green-100 text-green-800',
      overdue: 'bg-orange-100 text-orange-800',
    };
    const labels: Record<string, string> = {
      unpaid: 'Non payée',
      partially_paid: 'Partiellement payée',
      fully_paid: 'Payée',
      overdue: 'En retard',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.unpaid}`}>
        {labels[status] || status}
      </span>
    );
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Ventes & Encaissements</h1>
            <p className="text-gray-600">Gestion des ventes et des paiements clients</p>
          </div>
          <Button onClick={() => router.push('/sales/new')}>+ Nouvelle Vente</Button>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Chiffre d'Affaires</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(statistics.totalRevenue)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{statistics.salesCount} ventes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Encaissé</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(statistics.totalPaid)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{statistics.paidSalesCount} payées</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">À Encaisser</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(statistics.totalUnpaid)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{statistics.unpaidSalesCount} impayées</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Montant Moyen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(statistics.averageSaleAmount)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top Products & Clients */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Produits</CardTitle>
                <CardDescription>Produits les plus vendus</CardDescription>
              </CardHeader>
              <CardContent>
                {statistics.topProducts.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune donnée</p>
                ) : (
                  <div className="space-y-3">
                    {statistics.topProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                          <div>
                            <p className="font-medium">{product.productName}</p>
                            <p className="text-xs text-gray-500">{product.quantity} unités</p>
                          </div>
                        </div>
                        <p className="font-bold text-blue-600">{formatCurrency(product.revenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Clients</CardTitle>
                <CardDescription>Clients avec le plus de CA</CardDescription>
              </CardHeader>
              <CardContent>
                {statistics.topClients.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune donnée</p>
                ) : (
                  <div className="space-y-3">
                    {statistics.topClients.map((client, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                          <div>
                            <p className="font-medium">{client.clientName}</p>
                            <p className="text-xs text-gray-500">{client.salesCount} ventes</p>
                          </div>
                        </div>
                        <p className="font-bold text-green-600">{formatCurrency(client.totalRevenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                Toutes
              </Button>
              <Button
                variant={filter === 'confirmed' ? 'default' : 'outline'}
                onClick={() => setFilter('confirmed')}
              >
                Confirmées
              </Button>
              <Button
                variant={filter === 'draft' ? 'default' : 'outline'}
                onClick={() => setFilter('draft')}
              >
                Brouillons
              </Button>
              <Button
                variant={filter === 'fully_paid' ? 'default' : 'outline'}
                onClick={() => setFilter('fully_paid')}
              >
                Payées
              </Button>
              <Button
                variant={filter === 'unpaid' ? 'default' : 'outline'}
                onClick={() => setFilter('unpaid')}
              >
                Impayées
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sales List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Ventes</CardTitle>
            <CardDescription>{sales.length} vente{sales.length > 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : sales.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">Aucune vente trouvée</p>
                <Button onClick={() => router.push('/sales/new')}>Créer une vente</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Numéro
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Client
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Montant
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Payé
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Solde
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                        Statut
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                        Paiement
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sales.map((sale) => (
                      <tr
                        key={sale.SaleId}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => router.push(`/sales/${sale.SaleId}`)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">{sale.SaleNumber}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(sale.SaleDate)}</td>
                        <td className="px-4 py-3 text-sm">{sale.ClientName || 'Client anonyme'}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold">
                          {formatCurrency(sale.TotalAmount, sale.Currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                          {formatCurrency(sale.AmountPaid, sale.Currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600 font-medium">
                          {formatCurrency(sale.Balance, sale.Currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">{getStatusBadge(sale.Status)}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          {getPaymentStatusBadge(sale.PaymentStatus)}
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
