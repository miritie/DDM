/**
 * Page - Nouvelle Transaction
 * Module 7.3
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Wallet } from '@/types/modules';
import { DragDropUpload } from '@/components/upload/file-upload';

export default function NewTransactionPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [formData, setFormData] = React.useState({
    type: 'income' as 'income' | 'expense' | 'transfer',
    category: 'other',
    amount: '',
    sourceWalletId: '',
    destinationWalletId: '',
    description: '',
    reference: '',
    attachmentUrl: '',
  });
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    loadWallets();
  }, []);

  async function loadWallets() {
    try {
      const response = await fetch('/api/treasury/wallets?isActive=true');
      const data = await response.json();
      setWallets(data.data || []);
    } catch (error) {
      console.error('Error loading wallets:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/treasury/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création');
      }

      router.push('/treasury');
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
    }
  }

  const categories = [
    { value: 'sale', label: 'Vente' },
    { value: 'purchase', label: 'Achat' },
    { value: 'salary', label: 'Salaire' },
    { value: 'advance', label: 'Avance' },
    { value: 'debt_payment', label: 'Remboursement dette' },
    { value: 'expense', label: 'Dépense' },
    { value: 'transfer', label: 'Transfert' },
    { value: 'adjustment', label: 'Ajustement' },
    { value: 'other', label: 'Autre' },
  ];

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_CREATE}>
      <div className="container mx-auto p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Nouvelle Transaction</h1>
          <p className="mt-1 text-gray-500">
            Enregistrez un revenu, une dépense ou un transfert
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded">
                  {error}
                </div>
              )}

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de transaction
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="income"
                      checked={formData.type === 'income'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="mr-2"
                    />
                    💰 Revenu
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="expense"
                      checked={formData.type === 'expense'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="mr-2"
                    />
                    💸 Dépense
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="transfer"
                      checked={formData.type === 'transfer'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="mr-2"
                    />
                    🔄 Transfert
                  </label>
                </div>
              </div>

              {/* Catégorie */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Montant */}
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (FCFA)
                </label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  min="0"
                />
              </div>

              {/* Wallet Source (pour dépenses et transferts) */}
              {(formData.type === 'expense' || formData.type === 'transfer') && (
                <div>
                  <label htmlFor="sourceWalletId" className="block text-sm font-medium text-gray-700 mb-2">
                    Wallet source
                  </label>
                  <select
                    id="sourceWalletId"
                    value={formData.sourceWalletId}
                    onChange={(e) => setFormData({ ...formData, sourceWalletId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Sélectionner un wallet</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.WalletId} value={wallet.WalletId}>
                        {wallet.Name} - {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(wallet.Balance)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Wallet Destination (pour revenus et transferts) */}
              {(formData.type === 'income' || formData.type === 'transfer') && (
                <div>
                  <label htmlFor="destinationWalletId" className="block text-sm font-medium text-gray-700 mb-2">
                    Wallet destination
                  </label>
                  <select
                    id="destinationWalletId"
                    value={formData.destinationWalletId}
                    onChange={(e) => setFormData({ ...formData, destinationWalletId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Sélectionner un wallet</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.WalletId} value={wallet.WalletId}>
                        {wallet.Name} - {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(wallet.Balance)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  required
                />
              </div>

              {/* Référence */}
              <div>
                <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
                  Référence (optionnelle)
                </label>
                <Input
                  id="reference"
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                />
              </div>

              {/* Justificatif */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justificatif (optionnel)
                </label>
                <DragDropUpload
                  onUploadComplete={(result) => setFormData({ ...formData, attachmentUrl: result.url })}
                  onUploadError={(error) => alert(error)}
                  options={{
                    folder: 'treasury',
                    maxSize: 5 * 1024 * 1024,
                    allowedTypes: ['image/*', 'application/pdf'],
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Création...' : 'Créer la transaction'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
