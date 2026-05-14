'use client';

/**
 * Page - Approvisionnements stands (liste).
 * Commandes internes pour alimenter les stands depuis l'usine de production
 * et/ou l'entrepôt général. Pas de paiement, juste de la production + distribution.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  Truck, Plus, ArrowLeft, Loader2, AlertTriangle, Search,
} from 'lucide-react';

interface OrderRow {
  id: string;
  replenishment_id: string;
  replenishment_number: string;
  status: string;
  total_value_estimate: string;
  requested_delivery_date: string | null;
  created_at: string;
  requested_by_name: string | null;
  line_count: string;
  total_target_qty: number;
  total_received_qty: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'Soumise', approved: 'Approuvée',
  in_production: 'En production', produced: 'Produite',
  distributed: 'Distribuée', cancelled: 'Annulée',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-indigo-100 text-indigo-700',
  in_production: 'bg-purple-100 text-purple-700',
  produced: 'bg-violet-100 text-violet-700',
  distributed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' F';
}
function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReplenishmentsListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, [statusFilter]);

  async function load() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const r = await fetch(`/api/replenishments?${params}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Erreur ${r.status}`);
      }
      const j = await r.json();
      setOrders(j.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      o.replenishment_number.toLowerCase().includes(q) ||
      (o.requested_by_name || '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  return (
    <ProtectedPage permission={PERMISSIONS.REPLENISHMENT_VIEW}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Truck className="w-7 h-7 text-violet-600" /> Approvisionnements stands
            </h1>
            <p className="text-gray-600 text-sm">Commandes internes pour alimenter les stands depuis l'usine de production ou l'entrepôt général. Pas de paiement — distribution et suivi uniquement.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
            <Can permission={PERMISSIONS.REPLENISHMENT_CREATE}>
              <Button onClick={() => router.push('/replenishments/new')}>
                <Plus className="w-4 h-4 mr-2" /> Nouvelle demande
              </Button>
            </Can>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (n°, demandeur)…"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'draft', 'submitted', 'approved', 'in_production', 'produced', 'distributed'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  statusFilter === s ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-700 border-gray-200 hover:border-violet-400'
                }`}>
                {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-600" /></div>
        ) : error ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-orange-500 mb-3" />
            <p className="text-gray-700">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-500">
            {orders.length === 0 ? 'Aucune demande d\'approvisionnement.' : 'Aucun résultat pour ces filtres.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">N°</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Demandeur</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Livraison prévue</th>
                  <th className="px-4 py-3 text-right">Lignes</th>
                  <th className="px-4 py-3 text-right">Valeur</th>
                  <th className="px-4 py-3 text-right">Avancement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(o => {
                  const progress = o.total_target_qty > 0
                    ? Math.round((Number(o.total_received_qty) / Number(o.total_target_qty)) * 100)
                    : 0;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/replenishments/${o.id}`)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.replenishment_number}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{o.requested_by_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(o.requested_delivery_date)}</td>
                      <td className="px-4 py-3 text-right">{o.line_count}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(o.total_value_estimate))}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-xs font-medium text-gray-700">{progress}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
