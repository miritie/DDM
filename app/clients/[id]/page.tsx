'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  Building2, ArrowLeft, Loader2, AlertTriangle, Phone, Mail, MapPin,
  FileText, Pencil, Power, PowerOff, ShoppingCart,
} from 'lucide-react';

interface ClientDetail {
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
  createdAt: string;
}

interface OrderRow {
  id: string;
  order_id: string;
  order_number: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  currency: string;
  created_at: string;
  requested_delivery_date: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'Soumise', approved: 'Approuvée',
  in_production: 'En production', produced: 'Produite', transferred: 'Transférée',
  delivered: 'Livrée', completed: 'Soldée', cancelled: 'Annulée',
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' F';
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stats, setStats] = useState({ ordersCount: 0, totalAmount: 0, totalPaid: 0, totalOutstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', companyName: '', phone: '', email: '', address: '', taxId: '', creditLimit: 0,
  });

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`/api/clients/${id}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Erreur ${r.status}`);
      }
      const j = await r.json();
      setClient(j.data.client);
      setOrders(j.data.orders || []);
      setStats(j.data.stats);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    if (!client) return;
    setEditForm({
      name: client.name,
      companyName: client.companyName || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      taxId: client.taxId || '',
      creditLimit: client.creditLimit,
    });
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    try {
      const r = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Erreur');
      setEditing(false);
      await load();
    } catch (err: any) {
      alert(`❌ ${err.message}`);
    }
  }

  async function toggleActive() {
    if (!client) return;
    if (!confirm(`${client.isActive ? 'Désactiver' : 'Réactiver'} ce client ?`)) return;
    try {
      const r = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !client.isActive }),
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

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.CLIENT_VIEW}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </ProtectedPage>
    );
  }

  if (error || !client) {
    return (
      <ProtectedPage permission={PERMISSIONS.CLIENT_VIEW}>
        <div className="p-8 max-w-2xl mx-auto text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-orange-500 mb-3" />
          <p className="text-gray-700 mb-4">{error || 'Client introuvable'}</p>
          <Button variant="outline" onClick={() => router.push('/clients')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la liste
          </Button>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage permission={PERMISSIONS.CLIENT_VIEW}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/clients" className="hover:text-blue-600">Clients grossistes</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">{client.companyName || client.name}</span>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wider opacity-90">Client grossiste</p>
                <h1 className="text-2xl md:text-3xl font-bold">{client.companyName || client.name}</h1>
                <p className="text-sm opacity-90 font-mono">{client.code}</p>
                {client.companyName && <p className="text-sm opacity-90">Contact : {client.name}</p>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Can permission={PERMISSIONS.CLIENT_EDIT}>
                <Button onClick={startEdit} variant="outline" className="border-white text-white hover:bg-white/10">
                  <Pencil className="w-4 h-4 mr-2" /> Modifier
                </Button>
                <Button onClick={toggleActive} variant="outline" className="border-white text-white hover:bg-white/10">
                  {client.isActive ? <PowerOff className="w-4 h-4 mr-2" /> : <Power className="w-4 h-4 mr-2" />}
                  {client.isActive ? 'Désactiver' : 'Réactiver'}
                </Button>
              </Can>
              <Can permission={PERMISSIONS.SALES_CREATE}>
                <Button
                  onClick={() => router.push(`/orders/new?clientId=${client.id}`)}
                  className="bg-white text-blue-700 hover:bg-blue-50"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" /> Nouvelle commande
                </Button>
              </Can>
            </div>
          </div>
        </div>

        {/* Infos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Commandes</div>
            <div className="text-2xl font-bold">{stats.ordersCount}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">CA total</div>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Encaissé</div>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalPaid)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">À encaisser</div>
            <div className={`text-2xl font-bold ${stats.totalOutstanding > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
              {formatCurrency(stats.totalOutstanding)}
            </div>
            {client.creditLimit > 0 && (
              <div className="text-xs text-gray-500 mt-1">Plafond : {formatCurrency(client.creditLimit)}</div>
            )}
          </div>
        </div>

        {/* Contact + Form édition */}
        {editing ? (
          <form onSubmit={saveEdit} className="bg-white rounded-xl p-6 shadow-sm border border-blue-200 space-y-4">
            <h2 className="font-bold text-lg">Modifier le client</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Nom du contact *</label>
                <input required type="text" value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Société</label>
                <input type="text" value={editForm.companyName}
                  onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                  className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Téléphone</label>
                <input type="tel" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border rounded px-3 py-2" /></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Adresse</label>
                <input type="text" value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm font-medium mb-1">N° fiscal</label>
                <input type="text" value={editForm.taxId}
                  onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
                  className="w-full border rounded px-3 py-2" /></div>
              <div><label className="block text-sm font-medium mb-1">Plafond de crédit (XOF)</label>
                <input type="number" min={0} value={editForm.creditLimit}
                  onChange={(e) => setEditForm({ ...editForm, creditLimit: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2" /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Enregistrer</Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-2">
            <h2 className="font-bold text-lg mb-2">Coordonnées</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {client.phone && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4 text-gray-400" /> {client.phone}
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail className="w-4 h-4 text-gray-400" /> {client.email}
                </div>
              )}
              {client.address && (
                <div className="md:col-span-2 flex items-start gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" /> {client.address}
                </div>
              )}
              {client.taxId && (
                <div className="flex items-center gap-2 text-gray-700">
                  <FileText className="w-4 h-4 text-gray-400" /> N° fiscal : {client.taxId}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Commandes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Historique des commandes ({orders.length})</h2>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Aucune commande passée par ce client.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-4 py-2 text-left">N°</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Statut</th>
                    <th className="px-4 py-2 text-left">Livraison prévue</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">Payé</th>
                    <th className="px-4 py-2 text-right">Solde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/orders/${o.order_id}`)}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{o.order_number}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{STATUS_LABELS[o.status] || o.status}</span></td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(o.requested_delivery_date)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(Number(o.total_amount))}</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{formatCurrency(Number(o.amount_paid))}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${Number(o.balance) > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {formatCurrency(Number(o.balance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}
