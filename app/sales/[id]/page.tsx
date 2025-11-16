'use client';

/**
 * Page - Détails de Vente
 * Module Ventes & Encaissements
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sale, SaleItem, SalePayment, Wallet } from '@/types/modules';

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [sale, setSale] = useState<(Sale & { items: SaleItem[] }) | null>(null);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'cash' as 'cash' | 'bank_transfer' | 'mobile_money' | 'check' | 'card' | 'other',
    paymentDate: new Date().toISOString().split('T')[0],
    walletId: '',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    if (id) {
      loadData();
      loadWallets();
    }
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);

      // Load sale
      const saleRes = await fetch(`/api/sales/${id}`);
      if (!saleRes.ok) throw new Error('Vente non trouvée');
      const saleData = await saleRes.json();
      setSale(saleData.data);

      // Load payments
      const paymentsRes = await fetch(`/api/sales/${id}/payments`);
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.data || []);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function loadWallets() {
    try {
      const response = await fetch('/api/treasury/wallets?status=active');
      if (response.ok) {
        const data = await response.json();
        setWallets(data.data || []);
      }
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }

  async function handlePayment() {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      alert('Le montant doit être supérieur à 0');
      return;
    }

    if (parseFloat(paymentForm.amount) > (sale?.Balance || 0)) {
      alert('Le montant dépasse le solde restant');
      return;
    }

    try {
      const response = await fetch(`/api/sales/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod,
          paymentDate: paymentForm.paymentDate,
          walletId: paymentForm.walletId || undefined,
          reference: paymentForm.reference || undefined,
          notes: paymentForm.notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'enregistrement');
      }

      alert('Paiement enregistré avec succès!');
      setShowPaymentModal(false);
      setPaymentForm({
        amount: '',
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString().split('T')[0],
        walletId: '',
        reference: '',
        notes: '',
      });
      await loadData();
    } catch (error: any) {
      alert(error.message);
    }
  }

  async function handleCancel() {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette vente?')) return;

    try {
      const response = await fetch(`/api/sales/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erreur lors de l\'annulation');

      alert('Vente annulée avec succès');
      router.push('/sales');
    } catch (error: any) {
      alert(error.message);
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
      hour: '2-digit',
      minute: '2-digit',
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

  function getPaymentMethodLabel(method: string) {
    const labels: Record<string, string> = {
      cash: 'Espèces',
      bank_transfer: 'Virement bancaire',
      mobile_money: 'Mobile Money',
      check: 'Chèque',
      card: 'Carte bancaire',
      other: 'Autre',
    };
    return labels[method] || method;
  }

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.SALES_VIEW}>
        <div className="p-8">
          <div className="text-center">Chargement...</div>
        </div>
      </ProtectedPage>
    );
  }

  if (!sale) {
    return (
      <ProtectedPage permission={PERMISSIONS.SALES_VIEW}>
        <div className="p-8">
          <div className="text-center">Vente non trouvée</div>
          <div className="text-center mt-4">
            <Button onClick={() => router.push('/sales')}>Retour</Button>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  const paymentProgress = (sale.AmountPaid / sale.TotalAmount) * 100;

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="outline" onClick={() => router.push('/sales')} className="mb-2">
              ← Retour
            </Button>
            <h1 className="text-3xl font-bold">Vente {sale.SaleNumber}</h1>
            <p className="text-gray-600">{sale.ClientName || 'Client anonyme'}</p>
          </div>
          <div className="flex gap-2">
            {sale.Status !== 'cancelled' && sale.Balance > 0 && (
              <Button onClick={() => setShowPaymentModal(true)}>Enregistrer un Paiement</Button>
            )}
            {sale.Status !== 'cancelled' && (
              <Button variant="outline" onClick={handleCancel} className="text-red-600">
                Annuler la Vente
              </Button>
            )}
          </div>
        </div>

        {/* Sale Info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Informations de la Vente</CardTitle>
              {getStatusBadge(sale.Status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600">Date de Vente</p>
                <p className="font-medium">{formatDate(sale.SaleDate)}</p>
              </div>
              {sale.DueDate && (
                <div>
                  <p className="text-sm text-gray-600">Date d'Échéance</p>
                  <p className="font-medium">{formatDate(sale.DueDate)}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Montant Total</p>
                <p className="font-bold text-2xl text-blue-600">
                  {formatCurrency(sale.TotalAmount, sale.Currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Devise</p>
                <p className="font-medium">{sale.Currency}</p>
              </div>
            </div>
            {sale.Notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600 mb-1">Notes</p>
                <p className="text-sm">{sale.Notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>État des Paiements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Montant Payé</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(sale.AmountPaid, sale.Currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Solde Restant</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(sale.Balance, sale.Currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Progression</p>
                  <p className="text-2xl font-bold text-blue-600">{paymentProgress.toFixed(0)}%</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full transition-all"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Articles</CardTitle>
            <CardDescription>{sale.items.length} article{sale.items.length > 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Produit
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Quantité
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Prix Unitaire
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sale.items.map((item) => (
                    <tr key={item.SaleItemId}>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{item.ProductName}</div>
                        {item.Description && (
                          <div className="text-xs text-gray-500">{item.Description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{item.Quantity}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(item.UnitPrice, item.Currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {formatCurrency(item.TotalPrice, item.Currency)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50">
                    <td colSpan={3} className="px-4 py-3 text-right font-bold">
                      TOTAL
                    </td>
                    <td className="px-4 py-3 text-right text-xl font-bold text-blue-600">
                      {formatCurrency(sale.TotalAmount, sale.Currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Payments History */}
        <Card>
          <CardHeader>
            <CardTitle>Historique des Paiements</CardTitle>
            <CardDescription>{payments.length} paiement{payments.length > 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucun paiement enregistré</p>
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
                        Méthode
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Montant
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Référence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {payments.map((payment) => (
                      <tr key={payment.PaymentId}>
                        <td className="px-4 py-3 text-sm font-medium">{payment.PaymentNumber}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(payment.PaymentDate)}</td>
                        <td className="px-4 py-3 text-sm">
                          {getPaymentMethodLabel(payment.PaymentMethod)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                          {formatCurrency(payment.Amount, sale.Currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {payment.Reference || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Enregistrer un Paiement</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Montant (Max: {formatCurrency(sale.Balance, sale.Currency)})</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Méthode de Paiement</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="cash">Espèces</option>
                    <option value="bank_transfer">Virement bancaire</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="check">Chèque</option>
                    <option value="card">Carte bancaire</option>
                    <option value="other">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Date de Paiement</label>
                  <Input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Wallet (optionnel)</label>
                  <select
                    value={paymentForm.walletId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, walletId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Aucun wallet</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.WalletId} value={wallet.WalletId}>
                        {wallet.Name} ({formatCurrency(wallet.Balance, wallet.Currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Référence (optionnel)</label>
                  <Input
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    placeholder="Numéro de transaction..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes (optionnel)</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Notes..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button onClick={handlePayment} className="flex-1">
                  Enregistrer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1"
                >
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
