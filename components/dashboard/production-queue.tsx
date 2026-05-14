'use client';

/**
 * Composant - Corbeille manager_production
 *
 * Affiche les commandes clients négociées approuvées (à prendre en charge)
 * et celles déjà liées à un OP (in_production). Le manager peut voir le
 * besoin produit + quantité et déclencher un OP ou une sollicitation MP.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Inbox, ChevronRight, ChevronDown, ChevronUp, Factory, ShoppingBag,
  RefreshCw, AlertCircle, Truck, Package, Phone, CheckCircle, ArrowRight, Store,
} from 'lucide-react';

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

interface OrderLine {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  available_recipe_slug?: string;
}

interface OrderRow {
  id: string;
  order_id: string;
  order_number: string;
  client_name?: string;
  client_full_name?: string;
  client_phone?: string;
  total_amount: number;
  currency: string;
  status: 'approved' | 'in_production';
  requested_delivery_date?: string;
  approved_at?: string;
  notes?: string;
  line_count: number;
  linked_op_id?: string | null;
  linked_op_status?: string | null;
  lines: OrderLine[];
}

interface QueueData {
  pending: OrderRow[];
  inProgress: OrderRow[];
  replenishmentsPending: any[];
  replenishmentsInProgress: any[];
  totalCount: number;
}

export function ProductionQueue() {
  const router = useRouter();
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/dashboard/production-queue', { cache: 'no-store' });
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

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow border-2 border-blue-200 p-6">
        <div className="flex items-center gap-2 text-blue-700">
          <RefreshCw className="w-4 h-4 animate-spin" /> Chargement des sollicitations…
        </div>
      </div>
    );
  }
  if (error) return null; // silencieux si permission manquante
  if (!data) return null;

  const repPending = data.replenishmentsPending || [];
  const repInProgress = data.replenishmentsInProgress || [];
  const total = data.pending.length + data.inProgress.length + repPending.length + repInProgress.length;

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-blue-200">
      <div className="border-b border-blue-100 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Corbeille production</h2>
            <p className="text-sm text-gray-600">
              {total === 0
                ? 'Aucune sollicitation à produire'
                : `${data.pending.length + repPending.length} en attente · ${data.inProgress.length + repInProgress.length} en cours`}
            </p>
          </div>
        </div>
        <button onClick={load} className="p-2 hover:bg-blue-100 rounded-lg" title="Rafraîchir">
          <RefreshCw className="w-4 h-4 text-blue-700" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {data.pending.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> À prendre en charge ({data.pending.length})
            </h3>
            <div className="space-y-2">
              {data.pending.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  expanded={expanded.has(o.id)}
                  onToggle={() => toggle(o.id)}
                  onCreateOP={() => router.push(`/production/orders/new?customerOrderId=${o.order_id}`)}
                  onRequestMP={() => router.push('/production/purchase-requests/new')}
                />
              ))}
            </div>
          </div>
        )}

        {data.inProgress.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-1">
              <Factory className="w-4 h-4" /> En production ({data.inProgress.length})
            </h3>
            <div className="space-y-2">
              {data.inProgress.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  expanded={expanded.has(o.id)}
                  onToggle={() => toggle(o.id)}
                  tone="purple"
                  onOpenOP={() => router.push(`/production/orders/${o.linked_op_id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Réapprovisionnements stands à produire */}
        {repPending.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-cyan-800 mb-2 flex items-center gap-1">
              <Store className="w-4 h-4" /> Réappro stands à produire ({repPending.length})
            </h3>
            <div className="space-y-2">
              {repPending.map((r: any) => (
                <ReplenishmentCard
                  key={r.id}
                  replenishment={r}
                  expanded={expanded.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  onOpenDetail={() => router.push(`/replenishments/${r.replenishment_id}`)}
                  onCreateOP={() => router.push(`/production/orders/new?replenishmentId=${r.id}`)}
                />
              ))}
            </div>
          </div>
        )}
        {repInProgress.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-1">
              <Factory className="w-4 h-4" /> Réappro en production ({repInProgress.length})
            </h3>
            <div className="space-y-2">
              {repInProgress.map((r: any) => (
                <ReplenishmentCard
                  key={r.id}
                  replenishment={r}
                  expanded={expanded.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  tone="purple"
                  onOpenDetail={() => router.push(`/replenishments/${r.replenishment_id}`)}
                  onOpenOP={() => router.push(`/production/orders/${r.linked_op_slug}`)}
                />
              ))}
            </div>
          </div>
        )}

        {total === 0 && (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-900">Aucune commande en attente</p>
            <p className="text-sm text-gray-500">
              Les sollicitations validées par l'admin apparaîtront ici.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReplenishmentCard({ replenishment: r, expanded, onToggle, onOpenDetail, onCreateOP, onOpenOP, tone = 'cyan' }: {
  replenishment: any;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  onCreateOP?: () => void;
  onOpenOP?: () => void;
  tone?: 'cyan' | 'purple';
}) {
  const border = tone === 'purple' ? 'border-purple-200 bg-purple-50/30' : 'border-cyan-200 bg-cyan-50/30';
  const lines = (r.lines || []) as any[];
  const totalReq = lines.reduce((s, l) => s + Number(l.quantity_requested), 0);
  const totalProd = lines.reduce((s, l) => s + Number(l.quantity_produced), 0);
  return (
    <div className={`border-2 rounded-xl ${border}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-left hover:bg-white/50 rounded-xl transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold">Réappro stands</span>
            <span className="text-xs px-2 py-0.5 rounded bg-white border">{r.replenishment_number}</span>
            {r.linked_op_status && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-200 text-purple-900">
                OP {r.linked_op_status}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            par <strong>{r.requested_by_name || 'Manager commercial'}</strong> · {lines.length} produit{lines.length > 1 ? 's' : ''}
            {totalReq > 0 && <> · {fmt(totalProd)}/{fmt(totalReq)} produits</>}
            {r.requested_delivery_date && <> · livraison {fmtDate(r.requested_delivery_date)}</>}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t bg-white px-3 py-3 rounded-b-xl space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Produits demandés</h4>
            <div className="space-y-1">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.product_name}</p>
                    <p className="text-xs text-gray-500">{l.product_code}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold">{fmt(l.quantity_requested)}</p>
                    {l.available_recipe_slug ? (
                      <p className="text-xs text-green-600">✓ recette dispo</p>
                    ) : (
                      <p className="text-xs text-orange-600">⚠ pas de recette</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {r.notes && (
            <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-900">
              <strong>Note :</strong> {r.notes}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <button onClick={onOpenDetail} className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
              <Truck className="w-4 h-4" /> Détail réappro
            </button>
            {onOpenOP && (
              <button onClick={onOpenOP} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                <Factory className="w-4 h-4" /> Ouvrir l'OP
              </button>
            )}
            {onCreateOP && (
              <button onClick={onCreateOP} className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                <Factory className="w-4 h-4" /> Créer un OP
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, expanded, onToggle, onCreateOP, onRequestMP, onOpenOP, tone = 'amber' }: {
  order: OrderRow;
  expanded: boolean;
  onToggle: () => void;
  onCreateOP?: () => void;
  onRequestMP?: () => void;
  onOpenOP?: () => void;
  tone?: 'amber' | 'purple';
}) {
  const border = tone === 'purple' ? 'border-purple-200 bg-purple-50/30' : 'border-amber-200 bg-amber-50/30';
  return (
    <div className={`border-2 rounded-xl ${border}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-left hover:bg-white/50 rounded-xl transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold">{order.client_full_name || order.client_name || 'Client'}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-white border">{order.order_number}</span>
            {order.linked_op_status && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-200 text-purple-900">
                OP {order.linked_op_status}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {order.line_count} produit{order.line_count > 1 ? 's' : ''} · {fmt(order.total_amount)} {order.currency}
            {order.requested_delivery_date && <> · livraison {fmtDate(order.requested_delivery_date)}</>}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t bg-white px-3 py-3 rounded-b-xl space-y-3">
          {/* Lignes */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Besoins produits</h4>
            <div className="space-y-1">
              {order.lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.product_name}</p>
                    <p className="text-xs text-gray-500">{l.product_code}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold">{fmt(l.quantity)}</p>
                    {l.available_recipe_slug ? (
                      <p className="text-xs text-green-600">✓ recette dispo</p>
                    ) : (
                      <p className="text-xs text-orange-600">⚠ pas de recette</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Infos client */}
          <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
            {order.client_phone && (
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {order.client_phone}</span>
            )}
            <span>Approuvée {fmtDate(order.approved_at)}</span>
          </div>

          {order.notes && (
            <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-900">
              <strong>Note :</strong> {order.notes}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {onOpenOP && (
              <button onClick={onOpenOP} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                <Factory className="w-4 h-4" /> Ouvrir l'OP
              </button>
            )}
            {onCreateOP && (
              <button onClick={onCreateOP} className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                <Factory className="w-4 h-4" /> Créer un OP
              </button>
            )}
            {onRequestMP && (
              <button onClick={onRequestMP} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" /> Solliciter MP
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
