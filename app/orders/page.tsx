'use client';

/**
 * Liste des commandes clients négociées (différentes des ventes POS).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, ClipboardList, Filter } from 'lucide-react';

interface Order {
  id: string; order_number: string; client_full_name: string | null; client_name: string | null;
  total_amount: string; amount_paid: string; balance: string;
  status: string; line_count: number;
  created_at: string; requested_by_name: string | null;
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  draft:         { label: 'Brouillon',     cls: 'bg-gray-100 text-gray-700' },
  submitted:     { label: 'Soumise',       cls: 'bg-amber-100 text-amber-700' },
  approved:      { label: 'Approuvée',     cls: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'En production', cls: 'bg-purple-100 text-purple-700' },
  produced:      { label: 'Produite',      cls: 'bg-violet-100 text-violet-700' },
  transferred:   { label: 'Transférée',    cls: 'bg-cyan-100 text-cyan-700' },
  delivered:     { label: 'Livrée',        cls: 'bg-emerald-100 text-emerald-700' },
  completed:     { label: 'Soldée',        cls: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'Annulée',       cls: 'bg-red-100 text-red-700' },
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => { void load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/customer-orders' : `/api/customer-orders?status=${filter}`;
      const r = await fetch(url);
      if (r.ok) setOrders((await r.json()).data || []);
    } finally { setLoading(false); }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_VIEW}>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold">Commandes clients</h1>
              <p className="text-sm text-gray-600">Commandes négociées (≠ ventes POS) — pilotent production + livraison.</p>
            </div>
          </div>
          <Button onClick={() => router.push('/orders/new')}><Plus className="w-4 h-4 mr-1" /> Nouvelle commande</Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Filter className="w-4 h-4 text-gray-400" />
          {['all', 'draft', 'submitted', 'approved', 'in_production', 'produced', 'transferred', 'delivered', 'completed'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {s === 'all' ? 'Toutes' : STATUS_BADGES[s]?.label || s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : orders.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-3">Aucune commande</p>
            <Button onClick={() => router.push('/orders/new')}>Créer la première commande</Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2">N°</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Client</th>
                  <th className="text-left px-3 py-2">Demandeur</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Payé</th>
                  <th className="text-right px-3 py-2">Solde</th>
                  <th className="text-center px-3 py-2">Lignes</th>
                  <th className="text-center px-3 py-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map(o => {
                  const badge = STATUS_BADGES[o.status] || { label: o.status, cls: 'bg-gray-100 text-gray-700' };
                  return (
                    <tr key={o.id} onClick={() => router.push(`/orders/${o.id}`)}
                      className="hover:bg-blue-50 cursor-pointer">
                      <td className="px-3 py-2 font-mono text-xs">{o.order_number}</td>
                      <td className="px-3 py-2">{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-2">{o.client_full_name || o.client_name || <span className="text-gray-400 italic">—</span>}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">{o.requested_by_name || '—'}</td>
                      <td className="px-3 py-2 text-right font-bold">{Number(o.total_amount).toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{Number(o.amount_paid).toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-2 text-right text-orange-700">{Number(o.balance).toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-2 text-center text-xs">{o.line_count}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${badge.cls}`}>{badge.label}</span>
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
