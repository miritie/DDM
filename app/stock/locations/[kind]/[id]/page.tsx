'use client';

/**
 * Page - Stock focalisé d'un emplacement (entrepôt ou stand)
 *
 * Route : /stock/locations/[kind]/[id]
 *   - kind  : 'warehouse' | 'outlet'
 *   - id    : UUID PK ou slug métier (warehouse_id / code)
 *
 * Affiche :
 *   - en-tête + KPIs (nb articles, valeur, faibles, ruptures)
 *   - tableau filtrable et triable des stock_items de cet emplacement
 *   - actions : lancer inventaire, nouveau mouvement
 *   - 10 derniers mouvements
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Warehouse as WarehouseIcon, Store, Loader2, AlertTriangle,
  Package, DollarSign, TrendingDown, ListChecks, ArrowRightLeft,
  ArrowUp, ArrowDown, Search,
} from 'lucide-react';

type LocationKind = 'warehouse' | 'outlet';
type StatusFilter = 'all' | 'ok' | 'low' | 'out';
type SortKey = 'name' | 'quantity' | 'value' | 'updated';

interface SummaryItem {
  id: string;
  stockItemId: string;
  quantity: number;
  minimumStock: number;
  maximumStock: number | null;
  unitCost: number;
  totalValue: number;
  lastRestockDate: string | null;
  updatedAt: string;
  product: { id: string; code: string; name: string; sku: string; unitPrice: number | null; imageUrl: string | null };
}

interface SummaryMovement {
  id: string;
  movementNumber: string;
  type: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string | null;
  status: string;
  processedAt: string | null;
  processedByName: string | null;
  direction: 'in' | 'out';
  product: { name: string; sku: string };
}

interface SummaryData {
  location: { id: string; slug: string; name: string; kind: LocationKind };
  kpis: {
    itemsCount: number; totalValue: number; totalQuantity: number;
    lowStockCount: number; outOfStockCount: number;
  };
  items: SummaryItem[];
  recentMovements: SummaryMovement[];
}

function getStatus(qty: number, min: number): 'ok' | 'low' | 'out' {
  if (qty === 0) return 'out';
  if (qty <= min) return 'low';
  return 'ok';
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' F';
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function StockLocationPage() {
  const router = useRouter();
  const params = useParams();
  const kind = params?.kind as LocationKind;
  const id = params?.id as string;

  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { load(); }, [kind, id]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch(`/api/stock/locations/${kind}/${id}/summary`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Erreur ${r.status}`);
      }
      const j = await r.json();
      setData(j.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let list = data.items.filter(it => {
      if (q && !it.product.name.toLowerCase().includes(q) && !it.product.sku.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'all') {
        const s = getStatus(it.quantity, it.minimumStock);
        if (s !== statusFilter) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case 'name':     return a.product.name.localeCompare(b.product.name) * dir;
        case 'quantity': return (a.quantity - b.quantity) * dir;
        case 'value':    return (a.totalValue - b.totalValue) * dir;
        case 'updated':  return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
      }
    });
    return list;
  }, [data, search, statusFilter, sortKey, sortDir]);

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </ProtectedPage>
    );
  }

  if (error || !data) {
    return (
      <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
        <div className="p-8 max-w-2xl mx-auto text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-orange-500 mb-3" />
          <p className="text-gray-700 mb-4">{error || 'Données indisponibles'}</p>
          <Button variant="outline" onClick={() => router.back()}>Retour</Button>
        </div>
      </ProtectedPage>
    );
  }

  const isWarehouse = data.location.kind === 'warehouse';
  const LocIcon = isWarehouse ? WarehouseIcon : Store;
  const kindLabel = isWarehouse ? 'Entrepôt' : 'Stand';
  const inventoryParam = isWarehouse ? `warehouseId=${data.location.id}` : `outletId=${data.location.id}`;
  const movementParam = inventoryParam;
  const backHref = isWarehouse ? '/stock/warehouses' : '/stock/outlets';

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/stock" className="hover:text-blue-600">Stock</Link>
          <span>›</span>
          <Link href={backHref} className="hover:text-blue-600">
            {isWarehouse ? 'Entrepôts' : 'Stands'}
          </Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">{data.location.name}</span>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <LocIcon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wider opacity-90">{kindLabel}</p>
                <h1 className="text-2xl md:text-3xl font-bold">{data.location.name}</h1>
                <p className="text-sm opacity-90 font-mono">{data.location.slug}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Can permission={PERMISSIONS.STOCK_EDIT}>
                <Button
                  onClick={() => router.push(`/stock/inventory?${inventoryParam}`)}
                  className="bg-white text-blue-700 hover:bg-blue-50"
                >
                  <ListChecks className="w-4 h-4 mr-2" /> Lancer un inventaire
                </Button>
                <Button
                  onClick={() => router.push(`/stock/movements/quick?${movementParam}`)}
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Mouvement
                </Button>
              </Can>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1 text-gray-600 text-sm">
              <Package className="w-4 h-4" /> Articles
            </div>
            <p className="text-2xl font-bold text-gray-900">{data.kpis.itemsCount}</p>
            <p className="text-xs text-gray-500 mt-1">{formatNumber(data.kpis.totalQuantity)} unités</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1 text-gray-600 text-sm">
              <DollarSign className="w-4 h-4" /> Valeur
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(data.kpis.totalValue)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1 text-gray-600 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Stock faible
            </div>
            <p className="text-2xl font-bold text-amber-600">{data.kpis.lowStockCount}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-1 text-gray-600 text-sm">
              <TrendingDown className="w-4 h-4 text-red-600" /> Ruptures
            </div>
            <p className="text-2xl font-bold text-red-600">{data.kpis.outOfStockCount}</p>
          </div>
        </div>

        {/* Filtres + recherche */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit (nom ou code)…"
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'all', label: 'Tous',     count: data.kpis.itemsCount },
                { key: 'ok',  label: 'OK',       count: data.kpis.itemsCount - data.kpis.lowStockCount - data.kpis.outOfStockCount },
                { key: 'low', label: 'Faible',   count: data.kpis.lowStockCount },
                { key: 'out', label: 'Rupture',  count: data.kpis.outOfStockCount },
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
                  {f.label} <span className="ml-1 opacity-75">({f.count})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {data.items.length === 0
                ? `Aucun stock enregistré pour ce ${kindLabel.toLowerCase()}.`
                : 'Aucun produit ne correspond aux filtres.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <SortHeader label="Produit"           k="name"     onSort={toggleSort} cur={sortKey} dir={sortDir} />
                    <th className="px-4 py-3 text-left">Code</th>
                    <SortHeader label="Quantité"          k="quantity" onSort={toggleSort} cur={sortKey} dir={sortDir} align="right" />
                    <th className="px-4 py-3 text-right">Min</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                    <th className="px-4 py-3 text-right">Coût unit.</th>
                    <SortHeader label="Valeur"            k="value"    onSort={toggleSort} cur={sortKey} dir={sortDir} align="right" />
                    <SortHeader label="MAJ"               k="updated"  onSort={toggleSort} cur={sortKey} dir={sortDir} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map(it => {
                    const status = getStatus(it.quantity, it.minimumStock);
                    return (
                      <tr key={it.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{it.product.name}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{it.product.sku}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatNumber(it.quantity)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatNumber(it.minimumStock)}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(it.unitCost)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(it.totalValue)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(it.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mouvements récents */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">10 derniers mouvements</h2>
          </div>
          {data.recentMovements.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Aucun mouvement enregistré.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">N°</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Produit</th>
                    <th className="px-4 py-2 text-right">Quantité</th>
                    <th className="px-4 py-2 text-right">Coût</th>
                    <th className="px-4 py-2 text-left">Par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recentMovements.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-500">{formatDate(m.processedAt)}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{m.movementNumber}</td>
                      <td className="px-4 py-2"><MovementTypeBadge type={m.type} direction={m.direction} /></td>
                      <td className="px-4 py-2 text-gray-900">{m.product.name}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`font-semibold ${m.direction === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {m.direction === 'in' ? '+' : '−'}{formatNumber(m.quantity)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(m.totalCost)}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{m.processedByName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Retour */}
        <div className="flex justify-start">
          <Link href={backHref}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux {isWarehouse ? 'entrepôts' : 'stands'}
            </Button>
          </Link>
        </div>
      </div>
    </ProtectedPage>
  );
}

function SortHeader({
  label, k, cur, dir, onSort, align = 'left',
}: {
  label: string; k: SortKey; cur: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void; align?: 'left' | 'right';
}) {
  const active = cur === k;
  const Icon = active && dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`px-4 py-3 text-${align}`}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 text-xs uppercase font-semibold ${active ? 'text-blue-700' : 'text-gray-600'} hover:text-blue-700`}
      >
        {label}
        <Icon className={`w-3 h-3 ${active ? '' : 'opacity-30'}`} />
      </button>
    </th>
  );
}

function StatusBadge({ status }: { status: 'ok' | 'low' | 'out' }) {
  const map = {
    ok:  { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'OK' },
    low: { bg: 'bg-amber-100 text-amber-700 border-amber-200',       label: 'Faible' },
    out: { bg: 'bg-red-100 text-red-700 border-red-200',             label: 'Rupture' },
  } as const;
  const s = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg}`}>{s.label}</span>;
}

function MovementTypeBadge({ type, direction }: { type: string; direction: 'in' | 'out' }) {
  const labels: Record<string, string> = {
    in: 'Entrée', out: 'Sortie', transfer: 'Transfert', adjustment: 'Ajustement',
    markdown: 'Démarque', return: 'Retour',
  };
  const bg = direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg}`}>{labels[type] || type}</span>;
}
