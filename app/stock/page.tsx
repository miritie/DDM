'use client';

/**
 * Page - Stock — mobile-first.
 *
 * Standard maison : ÉTAT DES LIEUX d'abord (valeur, articles,
 * entrepôts, stock faible, ruptures — cliquables), actions du métier
 * (inventaire, mouvement, démarque, état global), accès par
 * emplacement, puis les alertes en liste compacte.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import {
  Package, Warehouse as WarehouseIcon, Store, AlertTriangle, TrendingDown,
  ListChecks, ArrowRightLeft, Eye, RefreshCw, Zap,
} from 'lucide-react';
import { StockStatistics, StockAlert, Warehouse, Product } from '@/types/modules';

const fmtCompact = (n: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M F';
  return new Intl.NumberFormat('fr-FR').format(Math.round(v)) + ' F';
};

export default function StockPage() {
  const router = useRouter();
  const [statistics, setStatistics] = useState<StockStatistics | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => { loadData(); }, []);

  async function fetchOrFail(url: string) {
    const res = await fetch(url);
    if (!res.ok) {
      let message = `Erreur ${res.status}`;
      try { const body = await res.json(); if (body?.error) message = body.error; } catch {}
      const err: any = new Error(message); err.status = res.status; throw err;
    }
    return res.json();
  }

  async function loadData() {
    try {
      setLoading(true);
      setLoadError(null);
      const [stats, alertsRes, warehousesRes, productsRes] = await Promise.all([
        fetchOrFail('/api/stock/statistics'),
        fetchOrFail('/api/stock/alerts'),
        fetchOrFail('/api/stock/warehouses?isActive=true'),
        fetchOrFail('/api/products?isActive=true'),
      ]);
      setStatistics(stats.data);
      setAlerts(alertsRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error: any) {
      setLoadError({ status: error.status || 500, message: error.message });
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  if (loadError) {
    const isPerm = loadError.status === 403;
    return (
      <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-orange-500 mb-3" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isPerm ? 'Accès au stock refusé' : 'Impossible de charger le stock'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {isPerm ? "Votre rôle actif n'a pas la permission « stock:view »." : loadError.message}
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold">Accueil</button>
              {!isPerm && <button onClick={loadData} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">Réessayer</button>}
            </div>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  const st = statistics;
  const ALERT_META: Record<string, { cls: string; label: string }> = {
    out_of_stock: { cls: 'bg-red-50 border-red-200 text-red-800', label: 'Rupture' },
    low_stock: { cls: 'bg-orange-50 border-orange-200 text-orange-800', label: 'Stock faible' },
    overstock: { cls: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Surstock' },
  };

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 pb-16">
        {/* Header compact */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Package className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">Stocks</h1>
                <p className="text-[11px] sm:text-sm opacity-90 truncate">Entrepôts, stands & mouvements</p>
              </div>
            </div>
            <button onClick={handleRefresh} disabled={refreshing} aria-label="Rafraîchir"
              className="p-2.5 bg-white/20 rounded-full hover:bg-white/30 shrink-0">
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4">
          {/* ===== ÉTAT DES LIEUX ===== */}
          <section className="bg-white border-2 border-blue-200 rounded-2xl p-3 sm:p-4">
            <h2 className="text-sm sm:text-base font-bold text-blue-900 mb-2">État des lieux</h2>
            {loading || !st ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <Stat label="Valeur totale" value={fmtCompact(st.totalValue)} tone="amber" href="/stock/overview" />
                <Stat label="Articles" value={String(st.totalItems)} href="/stock/overview" />
                <Stat label="Entrepôts" value={String(st.warehousesCount)} href="/stock/warehouses" />
                <Stat label="Stock faible" value={String(st.lowStockItems)}
                  tone={st.lowStockItems > 0 ? 'amber' : 'green'} href="/stock/alerts" />
                <Stat label="Ruptures" value={String(st.outOfStockItems)}
                  tone={st.outOfStockItems > 0 ? 'red' : 'green'} href="/stock/alerts" />
                <Stat label="Stands" value="Voir" href="/stock/outlets" />
              </div>
            )}
          </section>

          {/* ===== ACTIONS ===== */}
          <section className="grid grid-cols-2 gap-2.5">
            <ActionCard onClick={() => router.push('/stock/movements/quick')} icon={<ArrowRightLeft className="w-6 h-6" />}
              title="Mouvement" sub="Entrée / sortie" tone="blue" />
            <ActionCard onClick={() => router.push('/stock/inventory')} icon={<ListChecks className="w-6 h-6" />}
              title="Inventaire" sub="Comptage" tone="purple" />
            <ActionCard onClick={() => router.push('/stock/markdowns/new')} icon={<TrendingDown className="w-6 h-6" />}
              title="Démarque" sub="Pertes / casse" tone="red" />
            <ActionCard onClick={() => router.push('/stock/overview')} icon={<Eye className="w-6 h-6" />}
              title="État global" sub="Matrice + cumul" tone="emerald" />
          </section>

          {/* ===== PAR EMPLACEMENT ===== */}
          <section className="grid grid-cols-2 gap-2.5">
            <NavCard onClick={() => router.push('/stock/warehouses')} icon={<WarehouseIcon className="w-5 h-5" />}
              title="Entrepôts" sub={`${warehouses.length} actif(s)`} />
            <NavCard onClick={() => router.push('/stock/outlets')} icon={<Store className="w-5 h-5" />}
              title="Stands" sub="Stock par point de vente" />
          </section>

          {/* ===== ALERTES ===== */}
          {alerts.length > 0 && (
            <section className="bg-white border-2 border-orange-200 rounded-2xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm sm:text-base font-bold text-orange-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Alertes stock ({alerts.length})
                </h2>
                <Link href="/stock/alerts" className="text-xs font-bold text-orange-700 hover:underline">Tout voir →</Link>
              </div>
              <div className="space-y-2">
                {alerts.slice(0, 5).map((a) => {
                  const product = products.find((p) => p.ProductId === a.ProductId);
                  const wh = warehouses.find((w) => w.WarehouseId === a.WarehouseId);
                  const meta = ALERT_META[a.AlertType] || { cls: 'bg-gray-50 border-gray-200 text-gray-800', label: 'Alerte' };
                  return (
                    <button key={a.AlertId} onClick={() => router.push('/stock/movements/quick')}
                      className={`w-full text-left flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 active:scale-[0.99] ${meta.cls}`}>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{product?.Name || 'Produit'}</p>
                        <p className="text-xs opacity-80 truncate">{wh?.Name || 'Entrepôt'} · qté {a.CurrentQuantity}</p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold">
                        <Zap className="w-3.5 h-3.5" /> {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}

function Stat({ label, value, tone, href }: {
  label: string; value: string; tone?: 'amber' | 'red' | 'green'; href?: string;
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-900', red: 'bg-red-50 text-red-700', green: 'bg-emerald-50 text-emerald-700',
  };
  const cls = `block rounded-lg px-2 py-2 text-center ${tone ? tones[tone] : 'bg-gray-50 text-gray-900'}` +
    (href ? ' active:scale-95 hover:ring-2 hover:ring-blue-300' : '');
  const inner = (
    <>
      <p className="text-base sm:text-xl font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight mt-0.5">{label}</p>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function ActionCard({ onClick, icon, title, sub, tone }: {
  onClick: () => void; icon: React.ReactNode; title: string; sub: string;
  tone: 'blue' | 'purple' | 'red' | 'emerald';
}) {
  const chips: Record<string, { chip: string; border: string }> = {
    blue: { chip: 'bg-blue-100 text-blue-700', border: 'border-blue-200 hover:border-blue-400' },
    purple: { chip: 'bg-purple-100 text-purple-700', border: 'border-purple-200 hover:border-purple-400' },
    red: { chip: 'bg-red-100 text-red-700', border: 'border-red-200 hover:border-red-400' },
    emerald: { chip: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200 hover:border-emerald-400' },
  };
  return (
    <button onClick={onClick}
      className={`text-left bg-white border-2 rounded-2xl p-3.5 flex flex-col gap-2 transition-all active:scale-[0.99] ${chips[tone].border}`}>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${chips[tone].chip}`}>{icon}</span>
      <span>
        <span className="block font-bold text-sm text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{sub}</span>
      </span>
    </button>
  );
}

function NavCard({ onClick, icon, title, sub }: {
  onClick: () => void; icon: React.ReactNode; title: string; sub: string;
}) {
  return (
    <button onClick={onClick}
      className="text-left flex items-center gap-2.5 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-2xl p-3.5 transition-all active:scale-[0.99]">
      <span className="w-9 h-9 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-sm text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 truncate">{sub}</span>
      </span>
    </button>
  );
}
