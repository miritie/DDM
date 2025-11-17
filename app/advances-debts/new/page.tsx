'use client';

/**
 * Page - Création Avance/Dette
 * Module 7.5
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Account } from '@/types/modules';

export default function NewAdvanceDebtPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [formData, setFormData] = React.useState({
    type: 'advance' as 'advance' | 'debt',
    accountId: '',
    amount: '',
    reason: '',
    dueDate: '',
  });
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      setAccounts(data.data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/advances-debts', {
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

      const data = await response.json();
      router.push(`/advances-debts/${data.data.AdvanceDebtId}`);
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADVANCE_CREATE}>
      <div className="container mx-auto p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Nouvelle {formData.type === 'advance' ? 'Avance' : 'Dette'}
          </h1>
          <p className="mt-1 text-gray-500">
            Enregistrez une nouvelle {formData.type === 'advance' ? 'avance accordée' : 'dette contractée'}
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
                  Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="advance"
                      checked={formData.type === 'advance'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="mr-2"
                    />
                    💸 Avance
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="type"
                      value="debt"
                      checked={formData.type === 'debt'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="mr-2"
                    />
                    📋 Dette
                  </label>
                </div>
              </div>

              {/* Compte */}
              <div>
                <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 mb-2">
                  Compte (Tiers)
                </label>
                <select
                  id="accountId"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Sélectionner un compte</option>
                  {accounts.map((account) => (
                    <option key={account.AccountId} value={account.AccountId}>
                      {account.Code} - {account.Name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  <a href="/accounts/new" className="text-blue-600 hover:text-blue-700">
                    + Créer un nouveau compte
                  </a>
                </p>
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

              {/* Motif */}
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Motif/Description
                </label>
                <textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  required
                />
              </div>

              {/* Date d'échéance */}
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Date d'échéance (optionnelle)
                </label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Création...' : 'Créer'}
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
