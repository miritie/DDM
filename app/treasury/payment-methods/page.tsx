'use client';

/**
 * Page - Configuration des Moyens de paiement
 * Module Trésorerie
 *
 * Accessible aux profils Admin et Comptable (permission PAYMENT_METHOD_VIEW).
 * Politique : pas de suppression — activer / désactiver uniquement. Les
 * méthodes `is_system` peuvent être désactivées et renommées mais leur code
 * reste figé.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentMethod, WalletType } from '@/types/modules';
import { CreditCard, Plus, Power, PowerOff, Lock } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'inactive';

const WALLET_TYPE_OPTIONS: { value: WalletType | ''; label: string }[] = [
  { value: '',              label: 'Aucun (paiement sans encaissement direct)' },
  { value: 'cash',          label: 'Espèces' },
  { value: 'bank',          label: 'Banque' },
  { value: 'mobile_money',  label: 'Mobile Money' },
  { value: 'other',         label: 'Autre' },
];

const WALLET_TYPE_LABEL: Record<string, string> = {
  cash: 'Espèces',
  bank: 'Banque',
  mobile_money: 'Mobile Money',
  other: 'Autre',
};

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    label: '',
    requiredWalletType: '' as WalletType | '',
    displayOrder: 100,
    icon: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch('/api/treasury/payment-methods');
      if (r.ok) {
        const d = await r.json();
        setMethods(d.data || []);
      }
    } catch (e) {
      console.error('Error loading payment methods', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(pm: PaymentMethod) {
    const action = pm.IsActive ? 'désactiver' : 'activer';
    if (!confirm(`Confirmer : ${action} « ${pm.Label} » ?`)) return;
    try {
      setToggling(pm.PaymentMethodId);
      const r = await fetch(`/api/treasury/payment-methods/${pm.PaymentMethodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pm.IsActive }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Erreur');
      }
      await load();
    } catch (e: any) {
      alert(`❌ ${e.message}`);
    } finally {
      setToggling(null);
    }
  }

  function resetForm() {
    setForm({ code: '', label: '', requiredWalletType: '', displayOrder: 100, icon: '' });
    setEditingId(null);
    setShowCreateForm(false);
  }

  function startEdit(pm: PaymentMethod) {
    setForm({
      code: pm.Code,
      label: pm.Label,
      requiredWalletType: (pm.RequiredWalletType as WalletType) || '',
      displayOrder: pm.DisplayOrder,
      icon: pm.Icon || '',
    });
    setEditingId(pm.PaymentMethodId);
    setShowCreateForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        label: form.label.trim(),
        requiredWalletType: form.requiredWalletType || null,
        displayOrder: Number(form.displayOrder) || 100,
        icon: form.icon.trim() || null,
      };
      if (editingId) {
        const r = await fetch(`/api/treasury/payment-methods/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error || 'Erreur lors de la mise à jour');
        }
      } else {
        const r = await fetch('/api/treasury/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: form.code.trim(), ...payload }),
        });
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error || 'Erreur lors de la création');
        }
      }
      resetForm();
      await load();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
    }
  }

  const counts = useMemo(() => ({
    all: methods.length,
    active: methods.filter(m => m.IsActive).length,
    inactive: methods.filter(m => !m.IsActive).length,
  }), [methods]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return methods;
    return methods.filter(m => (statusFilter === 'active') === m.IsActive);
  }, [methods, statusFilter]);

  return (
    <ProtectedPage permission={PERMISSIONS.PAYMENT_METHOD_VIEW}>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CreditCard className="h-8 w-8 text-blue-600" />
              Moyens de paiement
            </h1>
            <p className="text-gray-600">Configuration des méthodes acceptées par la caisse, les dépenses et la paie</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/treasury')}>Retour</Button>
            <Can permission={PERMISSIONS.PAYMENT_METHOD_EDIT}>
              <Button onClick={() => { resetForm(); setShowCreateForm(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Nouveau moyen
              </Button>
            </Can>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            { key: 'all',      label: 'Tous',     count: counts.all },
            { key: 'active',   label: 'Actifs',   count: counts.active },
            { key: 'inactive', label: 'Inactifs', count: counts.inactive },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                statusFilter === f.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
              }`}
            >
              {f.label} <span className="ml-1 opacity-75">({f.count})</span>
            </button>
          ))}
        </div>

        {/* Formulaire création / édition */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? 'Modifier' : 'Nouveau moyen de paiement'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
                      placeholder="ex: wave, orange_money, crypto"
                      pattern="[a-z0-9_]+"
                      required
                      disabled={!!editingId}
                    />
                    <p className="text-xs text-gray-500 mt-1">Minuscules, chiffres et underscore uniquement. Non modifiable après création.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Libellé <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="ex: Wave, Orange Money"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Type de wallet requis</label>
                    <select
                      value={form.requiredWalletType}
                      onChange={(e) => setForm({ ...form, requiredWalletType: e.target.value as WalletType | '' })}
                      className="w-full border rounded px-3 py-2"
                    >
                      {WALLET_TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Ordre d'affichage</label>
                    <input
                      type="number"
                      value={form.displayOrder}
                      onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value, 10) })}
                      className="w-full border rounded px-3 py-2"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Icône (lucide)</label>
                    <input
                      type="text"
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="ex: Smartphone, CreditCard"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit">{editingId ? 'Enregistrer' : 'Créer'}</Button>
                  <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Liste */}
        {loading ? (
          <p className="text-center text-gray-500 py-12">Chargement...</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Aucun moyen de paiement dans ce statut.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((pm) => (
              <Card key={pm.PaymentMethodId} className={!pm.IsActive ? 'opacity-70' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2 truncate">
                        {pm.Label}
                        {pm.IsSystem && (
                          <span title="Méthode système (héritée de l'enum)" className="inline-flex">
                            <Lock className="h-4 w-4 text-gray-400" />
                          </span>
                        )}
                      </CardTitle>
                      <p className="text-sm text-gray-500 font-mono">{pm.Code}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      pm.IsActive
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {pm.IsActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Wallet requis</span>
                    <span className="text-sm font-medium">
                      {pm.RequiredWalletType ? WALLET_TYPE_LABEL[pm.RequiredWalletType] : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Ordre</span>
                    <span className="text-sm font-medium">{pm.DisplayOrder}</span>
                  </div>
                  {pm.Icon && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Icône</span>
                      <span className="text-sm font-mono">{pm.Icon}</span>
                    </div>
                  )}

                  <Can permission={PERMISSIONS.PAYMENT_METHOD_EDIT}>
                    <div className="flex gap-2 pt-3 border-t">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => startEdit(pm)}>
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggling === pm.PaymentMethodId}
                        onClick={() => handleToggle(pm)}
                        className={pm.IsActive
                          ? 'text-amber-700 border-amber-300 hover:bg-amber-50'
                          : 'text-green-700 border-green-300 hover:bg-green-50'}
                      >
                        {pm.IsActive ? (
                          <><PowerOff className="h-4 w-4 mr-1" />Désactiver</>
                        ) : (
                          <><Power className="h-4 w-4 mr-1" />Activer</>
                        )}
                      </Button>
                    </div>
                  </Can>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
