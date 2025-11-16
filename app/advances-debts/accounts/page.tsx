'use client';

/**
 * Page - Gestion des Comptes Tiers
 * Module Avances & Dettes
 * Agents, Fournisseurs, Clients
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Account } from '@/types/modules';
import { Users, Plus, UserCircle, Building, User } from 'lucide-react';

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'agent' | 'supplier' | 'client'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    accountType: 'agent' as 'agent' | 'supplier' | 'client' | 'other',
    name: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    loadAccounts();
  }, [filter]);

  async function loadAccounts() {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?accountType=${filter}` : '';
      const response = await fetch(`/api/accounts${params}`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.data || []);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();

    try {
      const response = await fetch('/api/accounts', {
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
        accountType: 'agent',
        name: '',
        email: '',
        phone: '',
        address: '',
      });
      loadAccounts();
      alert('✅ Compte créé avec succès!');
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  }

  function getAccountIcon(type: string) {
    const icons = {
      agent: <UserCircle className="h-5 w-5" />,
      supplier: <Building className="h-5 w-5" />,
      client: <User className="h-5 w-5" />,
      other: <Users className="h-5 w-5" />,
    };
    return icons[type as keyof typeof icons] || icons.other;
  }

  function getAccountColor(type: string) {
    const colors = {
      agent: 'text-blue-600 bg-blue-100',
      supplier: 'text-purple-600 bg-purple-100',
      client: 'text-green-600 bg-green-100',
      other: 'text-gray-600 bg-gray-100',
    };
    return colors[type as keyof typeof colors] || colors.other;
  }

  function getAccountLabel(type: string) {
    const labels = {
      agent: 'Agent',
      supplier: 'Fournisseur',
      client: 'Client',
      other: 'Autre',
    };
    return labels[type as keyof typeof labels] || type;
  }

  const accountsByType = {
    agent: accounts.filter((a) => a.AccountType === 'agent').length,
    supplier: accounts.filter((a) => a.AccountType === 'supplier').length,
    client: accounts.filter((a) => a.AccountType === 'client').length,
  };

  return (
    <ProtectedPage permission={PERMISSIONS.ADVANCE_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-blue-600" />
              Comptes Tiers
            </h1>
            <p className="text-gray-600">Gestion des agents, fournisseurs et clients</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/advances-debts')}>
              Retour
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Compte
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-blue-600" />
                Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{accountsByType.agent}</p>
              <p className="text-xs text-gray-500 mt-1">Employés et collaborateurs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Building className="h-4 w-4 text-purple-600" />
                Fournisseurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">{accountsByType.supplier}</p>
              <p className="text-xs text-gray-500 mt-1">Fournisseurs de services et produits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <User className="h-4 w-4 text-green-600" />
                Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{accountsByType.client}</p>
              <p className="text-xs text-gray-500 mt-1">Clients avec avances/dettes</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Créer un Compte Tiers</CardTitle>
              <CardDescription>Ajouter un agent, fournisseur ou client</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData({ ...formData, accountType: e.target.value as any })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="agent">👤 Agent</option>
                      <option value="supplier">🏢 Fournisseur</option>
                      <option value="client">👨 Client</option>
                      <option value="other">📋 Autre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Nom complet ou raison sociale"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="+225 XX XX XX XX XX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Adresse</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                    placeholder="Adresse complète"
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit">Créer le Compte</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({
                        accountType: 'agent',
                        name: '',
                        email: '',
                        phone: '',
                        address: '',
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

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2 flex-wrap">
              <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
                Tous ({accounts.length})
              </Button>
              <Button
                variant={filter === 'agent' ? 'default' : 'outline'}
                onClick={() => setFilter('agent')}
                className="inline-flex items-center gap-2"
              >
                <UserCircle className="h-4 w-4" />
                Agents ({accountsByType.agent})
              </Button>
              <Button
                variant={filter === 'supplier' ? 'default' : 'outline'}
                onClick={() => setFilter('supplier')}
                className="inline-flex items-center gap-2"
              >
                <Building className="h-4 w-4" />
                Fournisseurs ({accountsByType.supplier})
              </Button>
              <Button
                variant={filter === 'client' ? 'default' : 'outline'}
                onClick={() => setFilter('client')}
                className="inline-flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Clients ({accountsByType.client})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Accounts List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Comptes</CardTitle>
            <CardDescription>{accounts.length} compte(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Chargement...</p>
            ) : accounts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Aucun compte trouvé</p>
                <Button onClick={() => setShowCreateForm(true)}>Créer le premier compte</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((account) => (
                  <Card
                    key={account.AccountId}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push(`/advances-debts?accountId=${account.AccountId}`)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${getAccountColor(account.AccountType)}`}>
                          {getAccountIcon(account.AccountType)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{account.Name}</CardTitle>
                          <p className="text-sm text-gray-500">{account.Code}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Type</span>
                        <span className="text-sm font-medium">{getAccountLabel(account.AccountType)}</span>
                      </div>

                      {account.Email && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Email</span>
                          <span className="text-sm font-medium truncate ml-2">{account.Email}</span>
                        </div>
                      )}

                      {account.Phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Téléphone</span>
                          <span className="text-sm font-medium">{account.Phone}</span>
                        </div>
                      )}

                      {account.Address && (
                        <p className="text-sm text-gray-600 pt-2 border-t truncate">{account.Address}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
