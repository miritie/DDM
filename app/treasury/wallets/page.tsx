'use client';

/**
 * Page - Gestion des Portefeuilles (Wallets)
 * Module Trésorerie Multi-Wallet
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from '@/types/modules';
import { Wallet as WalletIcon, Plus, CreditCard, Smartphone, Banknote, DollarSign } from 'lucide-react';

export default function WalletsPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'cash' as 'cash' | 'bank' | 'mobile_money' | 'other',
    currency: 'XOF',
    initialBalance: 0,
    bankName: '',
    accountNumber: '',
    description: '',
  });

  useEffect(() => {
    loadWallets();
  }, []);

  async function loadWallets() {
    try {
      setLoading(true);
      const response = await fetch('/api/treasury/wallets?isActive=true');
      if (response.ok) {
        const data = await response.json();
        setWallets(data.data || []);
      }
    } catch (error) {
      console.error('Error loading wallets:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateWallet(e: React.FormEvent) {
    e.preventDefault();

    try {
      const response = await fetch('/api/treasury/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }

      setShowCreateForm(false);
      setFormData({
        name: '',
        type: 'cash',
        currency: 'XOF',
        initialBalance: 0,
        bankName: '',
        accountNumber: '',
        description: '',
      });
      loadWallets();
      alert('✅ Portefeuille créé avec succès!');
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  }

  function getWalletIcon(type: string) {
    const icons = {
      cash: <Banknote className="h-6 w-6" />,
      bank: <CreditCard className="h-6 w-6" />,
      mobile_money: <Smartphone className="h-6 w-6" />,
      other: <WalletIcon className="h-6 w-6" />,
    };
    return icons[type as keyof typeof icons] || icons.other;
  }

  function getWalletColor(type: string) {
    const colors = {
      cash: 'text-green-600 bg-green-100',
      bank: 'text-blue-600 bg-blue-100',
      mobile_money: 'text-purple-600 bg-purple-100',
      other: 'text-gray-600 bg-gray-100',
    };
    return colors[type as keyof typeof colors] || colors.other;
  }

  function getWalletLabel(type: string) {
    const labels = {
      cash: 'Espèces',
      bank: 'Banque',
      mobile_money: 'Mobile Money',
      other: 'Autre',
    };
    return labels[type as keyof typeof labels] || type;
  }

  function formatCurrency(amount: number, currency: string = 'XOF') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  }

  const totalBalance = wallets.reduce((sum, w) => sum + w.Balance, 0);

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <WalletIcon className="h-8 w-8 text-blue-600" />
              Portefeuilles
            </h1>
            <p className="text-gray-600">Gestion des comptes et portefeuilles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/treasury')}>
              Retour
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Portefeuille
            </Button>
          </div>
        </div>

        {/* Total Balance */}
        <Card className="mb-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Solde Total</p>
                <p className="text-4xl font-bold">{formatCurrency(totalBalance)}</p>
                <p className="text-blue-100 text-sm mt-1">{wallets.length} portefeuille(s) actif(s)</p>
              </div>
              <DollarSign className="h-16 w-16 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Créer un Portefeuille</CardTitle>
              <CardDescription>Ajouter un nouveau portefeuille de trésorerie</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateWallet} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nom du portefeuille <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ex: Caisse Principale, Compte Bancaire..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="cash">💵 Espèces</option>
                      <option value="bank">🏦 Banque</option>
                      <option value="mobile_money">📱 Mobile Money</option>
                      <option value="other">💰 Autre</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Devise</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="XOF">XOF - Franc CFA</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="USD">USD - Dollar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Solde Initial</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.initialBalance}
                      onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                </div>

                {formData.type === 'bank' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Nom de la banque</label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        placeholder="Ex: SGCI, BOA..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Numéro de compte</label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        placeholder="Ex: 12345678901234"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                    placeholder="Description optionnelle..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit">Créer le Portefeuille</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({
                        name: '',
                        type: 'cash',
                        currency: 'XOF',
                        initialBalance: 0,
                        bankName: '',
                        accountNumber: '',
                        description: '',
                      });
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Wallets List */}
        {loading ? (
          <p className="text-center text-gray-500 py-12">Chargement...</p>
        ) : wallets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <WalletIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun portefeuille créé</p>
              <Button onClick={() => setShowCreateForm(true)}>Créer le premier portefeuille</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets.map((wallet) => (
              <Card
                key={wallet.WalletId}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/treasury/wallets/${wallet.WalletId}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${getWalletColor(wallet.Type)}`}>
                        {getWalletIcon(wallet.Type)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{wallet.Name}</CardTitle>
                        <p className="text-sm text-gray-500">{wallet.Code}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Type</span>
                    <span className="text-sm font-medium">{getWalletLabel(wallet.Type)}</span>
                  </div>

                  {wallet.BankName && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Banque</span>
                      <span className="text-sm font-medium">{wallet.BankName}</span>
                    </div>
                  )}

                  {wallet.AccountNumber && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">N° Compte</span>
                      <span className="text-sm font-medium">{wallet.AccountNumber}</span>
                    </div>
                  )}

                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Solde</span>
                      <span className={`text-2xl font-bold ${wallet.Balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(wallet.Balance, wallet.Currency)}
                      </span>
                    </div>
                  </div>

                  {wallet.Description && (
                    <p className="text-sm text-gray-600 pt-2 border-t">{wallet.Description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
