'use client';

/**
 * Page - Production & Usine
 *
 * Vue d'ensemble manager production : corbeille des sollicitations entrantes,
 * actions à mener (MP, achats, OP), accès rapides, et liste des ordres
 * filtrable par statut workflow (draft → submitted → planned → in_progress
 * → completed).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Factory,
  Package,
  FileText,
  Plus,
  Beaker,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  ShoppingCart,
  ArrowRightLeft,
  Boxes,
  ShoppingBag,
} from 'lucide-react';
import { ProductionOrder } from '@/types/modules';
import { ProductionOrderCard } from '@/components/production/production-order-card';
import { ProductionQueue } from '@/components/dashboard/production-queue';
import { Button } from '@/components/ui/button';

interface ProductionStatistics {
  totalOrders: number;
  ordersInProgress: number;
  ordersCompleted: number;
  totalProduced: number;
  activeRecipes: number;
  avgYieldRate: number | null;
}

interface IngredientAlert {
  IngredientId: string;
  Name: string;
  CurrentStock: number;
  MinimumStock: number;
  Unit: string;
}

interface PurchaseRequestSummary {
  id: string;
  ExpenseRequestId: string;
  RequestNumber: string;
  Title: string;
  Amount: number;
  Status: string;
  ExpenseStatus?: string;
  lines?: any[];
  Lines?: any[];
}

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));

/**
 * Cycle de vie consolidé d'une sollicitation MP : combine workflow d'approbation,
 * paiement comptable et réception physique. Affiche l'étape la plus avancée.
 */
function purchaseRequestLifecycle(pr: PurchaseRequestSummary): { label: string; tone: string } {
  const status = pr.Status;
  if (status === 'draft')     return { label: 'Brouillon',                  tone: 'bg-gray-100 text-gray-700' };
  if (status === 'submitted') return { label: 'À valider',                  tone: 'bg-amber-100 text-amber-800' };
  if (status === 'rejected')  return { label: 'Refusée',                    tone: 'bg-red-100 text-red-700' };
  if (status === 'cancelled') return { label: 'Annulée',                    tone: 'bg-gray-100 text-gray-500' };

  const lines: any[] = pr.lines || pr.Lines || [];
  const totalReq = lines.reduce((s, l) => s + Number(l.QtyRequested ?? 0), 0);
  const totalRec = lines.reduce((s, l) => s + Number(l.QtyReceived ?? 0), 0);
  const fullyReceived = totalReq > 0 && totalRec >= totalReq;
  const partiallyReceived = totalRec > 0 && !fullyReceived;

  if (fullyReceived)     return { label: 'Reçue',                            tone: 'bg-emerald-100 text-emerald-800' };
  if (partiallyReceived) return { label: 'Reçue partiellement',              tone: 'bg-cyan-100 text-cyan-800' };
  if (pr.ExpenseStatus === 'paid') return { label: 'Payée — attente réception', tone: 'bg-blue-100 text-blue-800' };
  return                        { label: 'Validée — attente comptable',      tone: 'bg-violet-100 text-violet-800' };
}

function isFullyReceived(p: PurchaseRequestSummary): boolean {
  const lines: any[] = p.lines || p.Lines || [];
  if (lines.length === 0) return false;
  const req = lines.reduce((s, l) => s + Number(l.QtyRequested ?? 0), 0);
  const rec = lines.reduce((s, l) => s + Number(l.QtyReceived ?? 0), 0);
  return req > 0 && rec >= req;
}

type StatusFilter = 'all' | 'draft' | 'submitted' | 'planned' | 'in_progress' | 'completed';

export default function ProductionPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [statistics, setStatistics] = useState<ProductionStatistics | null>(null);
  const [mpAlerts, setMpAlerts] = useState<IngredientAlert[]>([]);
  const [pendingPRs, setPendingPRs] = useState<PurchaseRequestSummary[]>([]);
  // UUID du 1er entrepôt marqué « source production ». Sert à pré-filtrer
  // les raccourcis Inventaire PF / Mouvement de stock.
  const [productionWarehouseId, setProductionWarehouseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [ordersRes, statsRes, mpRes, prRes, whRes] = await Promise.all([
        fetch('/api/production/orders'),
        fetch('/api/production/orders/statistics'),
        fetch('/api/production/ingredients?belowMinimum=true&isActive=true'),
        fetch('/api/production/purchase-requests'),
        fetch('/api/stock/warehouses?isActive=true&isProductionSource=true'),
      ]);

      if (ordersRes.ok) setOrders(((await ordersRes.json()).data) || []);
      if (statsRes.ok)  setStatistics((await statsRes.json()).data);
      if (mpRes.ok)     setMpAlerts(((await mpRes.json()).data) || []);

      if (prRes.ok) {
        const prData: PurchaseRequestSummary[] = ((await prRes.json()).data) || [];
        setPendingPRs(
          prData
            .filter((p) => ['draft', 'submitted', 'approved'].includes(p.Status))
            .filter((p) => !isFullyReceived(p))
        );
      }

      if (whRes.ok) {
        const whs = ((await whRes.json()).data || []) as any[];
        const prod = whs[0];
        if (prod) setProductionWarehouseId(prod.id || prod.warehouse_id || prod.WarehouseId);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  }

  const buckets = {
    draft:       orders.filter((o) => o.Status === 'draft'),
    submitted:   orders.filter((o) => o.Status === 'submitted'),
    planned:     orders.filter((o) => o.Status === 'planned'),
    in_progress: orders.filter((o) => o.Status === 'in_progress'),
    completed:   orders.filter((o) => o.Status === 'completed'),
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.Status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header compact */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6" />
            Production & Usine
          </h1>
          <p className="text-sm opacity-90 mt-0.5">Ordres de fabrication, recettes, intrants</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-3 space-y-4">

        {/* KPIs workflow — alignés sur les statuts réels du pipeline */}
        <div className="bg-white rounded-xl shadow-sm p-3">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <KpiCell label="Brouillons"   count={buckets.draft.length}       tone="gray"    onClick={() => setFilter('draft')} active={filter === 'draft'} />
            <KpiCell label="À valider"    count={buckets.submitted.length}   tone="amber"   onClick={() => setFilter('submitted')} active={filter === 'submitted'} />
            <KpiCell label="Planifiés"    count={buckets.planned.length}     tone="blue"    onClick={() => setFilter('planned')} active={filter === 'planned'} />
            <KpiCell label="En cours"     count={buckets.in_progress.length} tone="orange"  onClick={() => setFilter('in_progress')} active={filter === 'in_progress'} />
            <KpiCell label="Terminés"     count={buckets.completed.length}   tone="emerald" onClick={() => setFilter('completed')} active={filter === 'completed'} />
            <KpiCell
              label="Rendement"
              count={statistics?.avgYieldRate != null ? `${Math.round(statistics.avgYieldRate)}%` : '—'}
              tone="violet"
            />
          </div>
        </div>

        {/* Corbeille production — commandes clients & réappros à produire.
            Repliée par défaut : le manager voit les compteurs synthétiques
            (en attente / en production / réappros), ouvre au clic pour le détail. */}
        <ProductionQueue defaultCollapsed />

        {/* Actions à mener — bandes synthétiques, repliées par défaut.
            Le manager voit le titre + compteur ; déplie au clic pour le détail. */}
        {mpAlerts.length > 0 && (
          <CollapsibleBar
            icon={<Beaker className="w-4 h-4" />}
            title="Matières premières sous le minimum"
            count={mpAlerts.length}
            tone="orange"
            href="/production/ingredients?belowMinimum=1"
          >
            {mpAlerts.slice(0, 5).map((mp) => (
              <button
                key={mp.IngredientId}
                onClick={() => router.push(`/production/ingredients/${mp.IngredientId}`)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-orange-50 hover:bg-orange-100 border border-orange-100 text-left"
              >
                <span className="font-medium text-sm truncate">{mp.Name}</span>
                <span className="text-xs text-orange-700 shrink-0">
                  {fmt(mp.CurrentStock)} / min {fmt(mp.MinimumStock)} {mp.Unit}
                </span>
              </button>
            ))}
          </CollapsibleBar>
        )}

        {pendingPRs.length > 0 && (
          <CollapsibleBar
            icon={<ShoppingBag className="w-4 h-4" />}
            title="Sollicitations d'achat MP"
            count={pendingPRs.length}
            tone="amber"
            href="/production/purchase-requests"
            extraBadges={(() => {
              const groups = new Map<string, { label: string; tone: string; count: number }>();
              pendingPRs.forEach((pr) => {
                const lc = purchaseRequestLifecycle(pr);
                const existing = groups.get(lc.label);
                if (existing) existing.count++;
                else groups.set(lc.label, { ...lc, count: 1 });
              });
              return Array.from(groups.values());
            })()}
          >
            {pendingPRs.slice(0, 5).map((pr) => {
              const lc = purchaseRequestLifecycle(pr);
              return (
                <button
                  key={pr.id}
                  onClick={() => router.push(`/production/purchase-requests/${pr.ExpenseRequestId}`)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 border border-gray-100 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{pr.Title}</p>
                    <p className="text-xs text-gray-500">{pr.RequestNumber} · {fmt(pr.Amount)} XOF</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${lc.tone}`}>
                    {lc.label}
                  </span>
                </button>
              );
            })}
          </CollapsibleBar>
        )}

        {/* Accès rapides — production */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-sm text-gray-800 mb-3">Production</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <QuickAction href="/production/orders/new"           icon={Plus}           label="Nouvel ordre"      tone="orange" />
            <QuickAction href="/orders"                          icon={ShoppingCart}   label="Commandes clients" tone="emerald" />
            <QuickAction href="/production/recipes"              icon={FileText}       label="Recettes"          tone="purple" />
            <QuickAction href="/production/ingredients"          icon={Beaker}         label="Matières premières" tone="blue" />
            <QuickAction href="/production/ingredients/inventory" icon={ClipboardList} label="Inventaire MP"     tone="teal" />
            <QuickAction href="/production/purchase-requests"    icon={Package}        label="Achats MP"         tone="amber" />
          </div>
        </div>

        {/* Accès rapides — stock produits finis */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-sm text-gray-800 mb-3">Stock produits finis</h2>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction
              href={productionWarehouseId ? `/stock/inventory?warehouseId=${productionWarehouseId}` : '/stock/inventory'}
              icon={Boxes} label="Inventaire PF" tone="emerald"
            />
            <QuickAction
              href="/stock/transfers/new?fromProduction=1"
              icon={ArrowRightLeft} label="Mouvement de stock" tone="cyan"
            />
          </div>
        </div>

        {/* Filtres + liste */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex gap-1.5 overflow-x-auto">
              <FilterChip label="Tous"        active={filter === 'all'}         onClick={() => setFilter('all')} />
              <FilterChip label="Brouillons"  active={filter === 'draft'}       onClick={() => setFilter('draft')} />
              <FilterChip label="À valider"   active={filter === 'submitted'}   onClick={() => setFilter('submitted')} />
              <FilterChip label="Planifiés"   active={filter === 'planned'}     onClick={() => setFilter('planned')} />
              <FilterChip label="En cours"    active={filter === 'in_progress'} onClick={() => setFilter('in_progress')} />
              <FilterChip label="Terminés"    active={filter === 'completed'}   onClick={() => setFilter('completed')} />
            </div>
            <span className="text-xs text-gray-500">
              {filteredOrders.length} {filteredOrders.length > 1 ? 'ordres' : 'ordre'}
            </span>
          </div>

          {filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <ProductionOrderCard
                  key={order.ProductionOrderId}
                  order={order}
                  onClick={() => router.push(`/production/orders/${order.ProductionOrderId}`)}
                  showDetails={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Factory className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-3">Aucun ordre dans ce filtre</p>
              <Button
                onClick={() => router.push('/production/orders/new')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer un ordre
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Composants internes ───────────────────────── */

function KpiCell({
  label, count, tone, onClick, active,
}: {
  label: string;
  count: number | string;
  tone: 'gray' | 'amber' | 'blue' | 'orange' | 'emerald' | 'violet';
  onClick?: () => void;
  active?: boolean;
}) {
  const palette: Record<string, { text: string; bg: string; activeBg: string; activeText: string }> = {
    gray:    { text: 'text-gray-700',    bg: 'hover:bg-gray-50',    activeBg: 'bg-gray-100',    activeText: 'text-gray-900' },
    amber:   { text: 'text-amber-700',   bg: 'hover:bg-amber-50',   activeBg: 'bg-amber-100',   activeText: 'text-amber-900' },
    blue:    { text: 'text-blue-700',    bg: 'hover:bg-blue-50',    activeBg: 'bg-blue-100',    activeText: 'text-blue-900' },
    orange:  { text: 'text-orange-700',  bg: 'hover:bg-orange-50',  activeBg: 'bg-orange-100',  activeText: 'text-orange-900' },
    emerald: { text: 'text-emerald-700', bg: 'hover:bg-emerald-50', activeBg: 'bg-emerald-100', activeText: 'text-emerald-900' },
    violet:  { text: 'text-violet-700',  bg: 'hover:bg-violet-50',  activeBg: 'bg-violet-100',  activeText: 'text-violet-900' },
  };
  const c = palette[tone];
  const isButton = !!onClick;
  const baseClass = `rounded-lg px-3 py-2 text-center transition-colors ${
    active ? `${c.activeBg} ${c.activeText}` : `${c.text} ${isButton ? c.bg : ''}`
  }`;
  const content = (
    <>
      <p className="text-xl font-bold leading-none">{count}</p>
      <p className="text-[11px] mt-1 font-medium">{label}</p>
    </>
  );
  return isButton ? (
    <button onClick={onClick} className={baseClass}>{content}</button>
  ) : (
    <div className={baseClass}>{content}</div>
  );
}

function CollapsibleBar({
  icon, title, count, tone, href, children, extraBadges,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  tone: 'orange' | 'amber';
  href: string;
  children: React.ReactNode;
  extraBadges?: Array<{ label: string; tone: string; count: number }>;
}) {
  const [open, setOpen] = useState(false);
  const palette = {
    orange: { border: 'border-orange-200', icon: 'bg-orange-500',  hover: 'hover:bg-orange-50/40', badge: 'bg-orange-100 text-orange-800' },
    amber:  { border: 'border-amber-200',  icon: 'bg-amber-500',   hover: 'hover:bg-amber-50/40',  badge: 'bg-amber-100 text-amber-800' },
  }[tone];

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${palette.border}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left rounded-t-xl transition-colors ${palette.hover}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-8 h-8 ${palette.icon} rounded-lg flex items-center justify-center text-white shrink-0`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-sm text-gray-900">{title}</h2>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${palette.badge}`}>{count}</span>
              {extraBadges?.map((b) => (
                <span key={b.label} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.tone}`}>
                  {b.count} {b.label.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-gray-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-1.5">
          {children}
          {count > 5 && (
            <Link href={href} className="block text-center text-xs text-orange-600 hover:underline pt-2">
              Voir les {count - 5} autres →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function QuickAction({
  href, icon: Icon, label, tone,
}: {
  href: string;
  icon: any;
  label: string;
  tone: 'orange' | 'emerald' | 'purple' | 'blue' | 'teal' | 'amber' | 'cyan';
}) {
  const palette: Record<string, string> = {
    orange:  'text-orange-700  bg-orange-50  hover:bg-orange-100  border-orange-200',
    emerald: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    purple:  'text-purple-700  bg-purple-50  hover:bg-purple-100  border-purple-200',
    blue:    'text-blue-700    bg-blue-50    hover:bg-blue-100    border-blue-200',
    teal:    'text-teal-700    bg-teal-50    hover:bg-teal-100    border-teal-200',
    amber:   'text-amber-700   bg-amber-50   hover:bg-amber-100   border-amber-200',
    cyan:    'text-cyan-700    bg-cyan-50    hover:bg-cyan-100    border-cyan-200',
  };
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-lg border transition-colors ${palette[tone]}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-xs font-semibold text-center leading-tight">{label}</span>
    </Link>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
        active ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
