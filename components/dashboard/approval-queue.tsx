'use client';

/**
 * Composant - File de validation admin
 *
 * Agrège les sollicitations en attente :
 *   - commandes clients submitted
 *   - ordres de production submitted
 *   - achats MP submitted (expense_requests catégorie achat_mp)
 *
 * Affiche un badge global + 3 colonnes pour décider rapidement.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ShoppingCart, Factory, ShoppingBag, ChevronRight, RefreshCw, CheckCircle,
} from 'lucide-react';

interface QueueData {
  customerOrders: any[];
  productionOrders: any[];
  purchaseRequests: any[];
  totalCount: number;
}

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));

export function ApprovalQueue() {
  const router = useRouter();
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/dashboard/approval-queue', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      setData(j.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow border-2 border-amber-200 p-6">
        <div className="flex items-center gap-2 text-amber-700">
          <RefreshCw className="w-4 h-4 animate-spin" /> Chargement de la file de validation…
        </div>
      </div>
    );
  }
  if (error) {
    // si l'user n'a pas les bonnes permissions, on n'affiche rien (silencieux)
    return null;
  }
  if (!data || data.totalCount === 0) {
    return (
      <div className="bg-white rounded-2xl shadow border-2 border-green-200 p-6 flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-600" />
        <div>
          <p className="font-semibold text-green-900">Aucune sollicitation en attente</p>
          <p className="text-sm text-green-700">Vous êtes à jour sur les validations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-amber-200">
      <div className="border-b border-amber-100 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">À valider</h2>
            <p className="text-sm text-gray-600">{data.totalCount} sollicitation{data.totalCount > 1 ? 's' : ''} en attente</p>
          </div>
        </div>
        <button onClick={load} className="p-2 hover:bg-amber-100 rounded-lg" title="Rafraîchir">
          <RefreshCw className="w-4 h-4 text-amber-700" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x">
        <Column
          icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
          title="Commandes clients"
          items={data.customerOrders.map((co) => ({
            id: co.order_id,
            primary: co.client_name || 'Client',
            secondary: `${co.order_number} · ${fmt(co.total_amount)} ${co.currency || 'XOF'}`,
            onClick: () => router.push(`/orders/${co.order_id}`),
          }))}
          emptyText="Aucune commande à valider"
        />
        <Column
          icon={<Factory className="w-5 h-5 text-orange-600" />}
          title="Ordres de production"
          items={data.productionOrders.map((po) => ({
            id: po.production_order_id,
            primary: po.product_name || po.order_number,
            secondary: `${po.order_number} · ${fmt(po.planned_quantity)} ${po.unit}${
              po.customer_order_number ? ` · ↳ ${po.customer_order_number}` : ''
            }`,
            onClick: () => router.push(`/production/orders/${po.production_order_id}`),
          }))}
          emptyText="Aucun OP à valider"
        />
        <Column
          icon={<ShoppingBag className="w-5 h-5 text-amber-600" />}
          title="Achats matières premières"
          items={data.purchaseRequests.map((pr) => ({
            id: pr.expense_request_id,
            primary: pr.title,
            secondary: `${pr.request_number} · ${fmt(pr.amount)} XOF`,
            onClick: () => router.push(`/production/purchase-requests/${pr.expense_request_id}`),
          }))}
          emptyText="Aucun achat à valider"
        />
      </div>
    </div>
  );
}

function Column({ icon, title, items, emptyText }: {
  icon: React.ReactNode;
  title: string;
  items: Array<{ id: string; primary: string; secondary: string; onClick: () => void }>;
  emptyText: string;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full bg-gray-50 hover:bg-gray-100 rounded-lg p-2.5 text-left flex items-center justify-between gap-2 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{item.primary}</p>
                <p className="text-xs text-gray-600 truncate">{item.secondary}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          ))}
          {items.length > 5 && (
            <p className="text-xs text-gray-500 text-center pt-1">+ {items.length - 5} autre{items.length - 5 > 1 ? 's' : ''}</p>
          )}
        </div>
      )}
    </div>
  );
}
