'use client';

/**
 * Page - Clients grossistes (B2B)
 *
 * Liste + filtres + création. Distinct des `customers` (B2C/fidélité) :
 * cette table sert aux commandes négociées par le manager commercial.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  Building2, Plus, Search, Loader2, ArrowLeft, AlertTriangle, Phone, Mail, Power, PowerOff,
} from 'lucide-react';

interface ClientRow {
  id: string;
  clientId: string;
  code: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
}

type StatusFilter = 'active' | 'inactive' | 'all';

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' F';
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    creditLimit: 0,
  });

  useEffect(() => { load(); }, [statusFilter]);

  async function load() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('isActive', String(statusFilter === 'active'));
      const r = await fetch(`/api/clients?${params}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Erreur ${r.status}`);
      }
      const j = await r.json();
      setClients(j.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.taxId || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { alert('Le nom est obligatoire'); return; }
    setCreating(true);
    try {
      const r = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          companyName: form.companyName || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          taxId: form.taxId || undefined,
          creditLimit: Number(form.creditLimit) || 0,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erreur');
      setShowCreate(false);
      setForm({ name: '', companyName: '', phone: '', email: '', address: '', taxId: '', creditLimit: 0 });
      await load();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(c: ClientRow) {
    if (!confirm(`${c.isActive ? 'Désactiver' : 'Réactiver'} le client « ${c.name} » ?`)) return;
    try {
      const r = await fetch(`/api/clients/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || 'Erreur');
      }
      await load();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.CLIENT_VIEW}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" /> Clients grossistes
            </h1>
            <p className="text-gray-600 text-sm">Comptes B2B pour les commandes négociées.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
            <Can permission={PERMISSIONS.CLIENT_CREATE}>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-2" /> Nouveau client
              </Button>
            </Can>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (nom, société, téléphone, code, N° fiscal)…"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {([
              { key: 'active',   label: 'Actifs'   },
              { key: 'inactive', label: 'Inactifs' },
              { key: 'all',      label: 'Tous'     },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  statusFilter === f.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form création */}
        {showCreate && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-200">
            <h2 className="font-bold text-lg mb-4">Nouveau client grossiste</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom du contact <span className="text-red-500">*</span></label>
                  <input required type="text" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ex: Adama Koné" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Société / Raison sociale</label>
                  <input type="text" value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ex: Sarl Distrib Abidjan" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Téléphone</label>
                  <input type="tel" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="07 00 00 00 00" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="contact@…" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Adresse</label>
                  <input type="text" value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Rue, quartier, ville…" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° fiscal / Compte contribuable</label>
                  <input type="text" value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Optionnel" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Plafond de crédit (XOF)</label>
                  <input type="number" min={0} value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
                    className="w-full border rounded px-3 py-2" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Créer
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              </div>
            </form>
          </div>
        )}

        {/* Liste */}
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : error ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-orange-500 mb-3" />
            <p className="text-gray-700">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-500">
            {clients.length === 0
              ? 'Aucun client grossiste enregistré pour ce workspace. Cliquez sur « Nouveau client » pour commencer.'
              : 'Aucun client ne correspond aux filtres.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Société / Contact</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-right">Plafond</th>
                  <th className="px-4 py-3 text-right">Solde</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${!c.isActive ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.code}</td>
                    <td className="px-4 py-3">
                      <Link href={`/clients/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {c.companyName || c.name}
                      </Link>
                      {c.companyName && <div className="text-xs text-gray-500">{c.name}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.phone && <div className="flex items-center gap-1 text-xs"><Phone className="w-3 h-3" /> {c.phone}</div>}
                      {c.email && <div className="flex items-center gap-1 text-xs"><Mail className="w-3 h-3" /> {c.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{c.creditLimit > 0 ? formatCurrency(c.creditLimit) : '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${c.currentBalance > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {formatCurrency(c.currentBalance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                        c.isActive
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {c.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Link href={`/clients/${c.id}`}>
                          <Button variant="outline" size="sm">Détail</Button>
                        </Link>
                        <Can permission={PERMISSIONS.CLIENT_EDIT}>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => toggleActive(c)}
                            className={c.isActive
                              ? 'text-amber-700 border-amber-300 hover:bg-amber-50'
                              : 'text-green-700 border-green-300 hover:bg-green-50'}
                          >
                            {c.isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                          </Button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
