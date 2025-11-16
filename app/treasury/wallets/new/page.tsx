'use client';

/**
 * Page - Création de Wallet
 * Module Trésorerie
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewWalletPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    type: 'cash' as 'cash' | 'bank' | 'mobile_money' | 'other',
    currency: 'XOF',
    initialBalance: '',
    description: '',
    bankName: '',
    accountNumber: '',
    iban: '',
    swiftCode: '',
    mobileOperator: '',
    mobileNumber: '',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(field: string, value: string) {
    setFormData({ ...formData, [field]: value });
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    }

    if (!formData.initialBalance || parseFloat(formData.initialBalance) < 0) {
      newErrors.initialBalance = 'Le solde initial doit être >= 0';
    }

    if (formData.type === 'bank') {
      if (!formData.bankName.trim()) {
        newErrors.bankName = 'Le nom de la banque est requis';
      }
      if (!formData.accountNumber.trim()) {
        newErrors.accountNumber = 'Le numéro de compte est requis';
      }
    }

    if (formData.type === 'mobile_money') {
      if (!formData.mobileOperator.trim()) {
        newErrors.mobileOperator = 'L\'opérateur est requis';
      }
      if (!formData.mobileNumber.trim()) {
        newErrors.mobileNumber = 'Le numéro est requis';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const payload: any = {
        Name: formData.name,
        Type: formData.type,
        Currency: formData.currency,
        InitialBalance: parseFloat(formData.initialBalance),
        Description: formData.description || undefined,
      };

      if (formData.type === 'bank') {
        payload.BankName = formData.bankName;
        payload.AccountNumber = formData.accountNumber;
        if (formData.iban) payload.IBAN = formData.iban;
        if (formData.swiftCode) payload.SwiftCode = formData.swiftCode;
      }

      if (formData.type === 'mobile_money') {
        payload.MobileOperator = formData.mobileOperator;
        payload.MobileNumber = formData.mobileNumber;
      }

      const response = await fetch('/api/treasury/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }

      const result = await response.json();
      alert('Wallet créé avec succès!');
      router.push(`/treasury/wallets/${result.data.WalletId}`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
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

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_CREATE}>
      <div className="p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button variant="outline" onClick={() => router.push('/treasury')} className="mb-4">
            ← Retour
          </Button>
          <h1 className="text-3xl font-bold">Créer un Wallet</h1>
          <p className="text-gray-600">Ajoutez un nouveau wallet à votre trésorerie</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type Selection */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Type de Wallet</CardTitle>
              <CardDescription>Sélectionnez le type de wallet à créer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: 'cash', label: 'Espèces', icon: '💵' },
                  { value: 'bank', label: 'Banque', icon: '🏦' },
                  { value: 'mobile_money', label: 'Mobile Money', icon: '📱' },
                  { value: 'other', label: 'Autre', icon: '💰' },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleChange('type', type.value)}
                    className={`p-4 border-2 rounded-lg text-center transition-all ${
                      formData.type === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-2">{type.icon}</div>
                    <div className="font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{getWalletIcon(formData.type)} Informations de Base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nom du Wallet <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ex: Caisse Principale, Compte BNI, Orange Money..."
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Devise <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="XOF">XOF - Franc CFA</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - Dollar</option>
                    <option value="GNF">GNF - Franc Guinéen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Solde Initial <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.initialBalance}
                    onChange={(e) => handleChange('initialBalance', e.target.value)}
                    placeholder="0.00"
                    className={errors.initialBalance ? 'border-red-500' : ''}
                  />
                  {errors.initialBalance && (
                    <p className="text-red-500 text-sm mt-1">{errors.initialBalance}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description (optionnel)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Description ou notes sur ce wallet..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bank-specific Fields */}
          {formData.type === 'bank' && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>🏦 Informations Bancaires</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nom de la Banque <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.bankName}
                    onChange={(e) => handleChange('bankName', e.target.value)}
                    placeholder="Ex: BNI, Ecobank, UBA..."
                    className={errors.bankName ? 'border-red-500' : ''}
                  />
                  {errors.bankName && <p className="text-red-500 text-sm mt-1">{errors.bankName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Numéro de Compte <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.accountNumber}
                    onChange={(e) => handleChange('accountNumber', e.target.value)}
                    placeholder="Numéro de compte bancaire"
                    className={errors.accountNumber ? 'border-red-500' : ''}
                  />
                  {errors.accountNumber && (
                    <p className="text-red-500 text-sm mt-1">{errors.accountNumber}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">IBAN (optionnel)</label>
                    <Input
                      value={formData.iban}
                      onChange={(e) => handleChange('iban', e.target.value)}
                      placeholder="FR76 1234 5678 9012 3456 7890 123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Code SWIFT (optionnel)</label>
                    <Input
                      value={formData.swiftCode}
                      onChange={(e) => handleChange('swiftCode', e.target.value)}
                      placeholder="BNPAFRPP"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mobile Money-specific Fields */}
          {formData.type === 'mobile_money' && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>📱 Informations Mobile Money</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Opérateur <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.mobileOperator}
                    onChange={(e) => handleChange('mobileOperator', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.mobileOperator ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Sélectionner un opérateur</option>
                    <option value="orange">Orange Money</option>
                    <option value="mtn">MTN Money</option>
                    <option value="moov">Moov Money</option>
                    <option value="wave">Wave</option>
                    <option value="other">Autre</option>
                  </select>
                  {errors.mobileOperator && (
                    <p className="text-red-500 text-sm mt-1">{errors.mobileOperator}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Numéro de Téléphone <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.mobileNumber}
                    onChange={(e) => handleChange('mobileNumber', e.target.value)}
                    placeholder="Ex: +224 XXX XXX XXX"
                    className={errors.mobileNumber ? 'border-red-500' : ''}
                  />
                  {errors.mobileNumber && (
                    <p className="text-red-500 text-sm mt-1">{errors.mobileNumber}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Création en cours...' : 'Créer le Wallet'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/treasury')}
              disabled={loading}
              className="flex-1"
            >
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </ProtectedPage>
  );
}
