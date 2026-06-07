'use client';

/**
 * Page - Rapports & Analytics — dashboard décisionnel (PCA / direction).
 *
 * Mobile-first. Capacités :
 *   - Période : presets (7j, 30j, mois, mois dernier, trimestre, année) ou
 *     personnalisée, avec SUPERPOSITION d'une période de comparaison
 *     (période précédente équivalente ou même période l'an dernier)
 *   - Filtres MULTI-SÉLECTION : stands, vendeurs
 *   - Dimension d'analyse (réalités face à face) : global, par stand,
 *     par vendeur, par produit, par catégorie de dépense
 *   - Métriques : CA, encaissé, à recouvrer, nb ventes, quantités,
 *     dépenses, net de trésorerie
 *   - Bascule TABLEAU ⇄ GRAPHIQUE en un clic (courbes temporelles,
 *     barres comparées en face-à-face)
 *
 * Les données arrivent pré-agrégées au jour (API /api/analytics/overview)
 * et tous les croisements se font côté client — instantané.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2, BarChart3, Table2, ChevronDown, X, TrendingUp, TrendingDown,
  RefreshCw, SlidersHorizontal,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types & helpers

interface SalesFact { day: string; outlet: string; seller: string; sales_count: number; revenue: number; paid: number; credit: number }
interface ProductFact { day: string; outlet: string; product: string; qty: number; revenue: number }
interface ExpenseFact { day: string; category: string; amount: number }
interface Overview { from: string; to: string; sales: SalesFact[]; products: ProductFact[]; expenses: ExpenseFact[] }

type Preset = '7d' | '30d' | 'month' | 'lastMonth' | 'quarter' | 'year' | 'custom';
type Compare = 'none' | 'previous' | 'lastYear';
type Metric = 'revenue' | 'paid' | 'credit' | 'count' | 'qty' | 'expenses' | 'net';
type Dimension = 'global' | 'outlet' | 'seller' | 'product' | 'expense_category';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: 'month', label: 'Ce mois' },
  { key: 'lastMonth', label: 'Mois dernier' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'year', label: 'Année' },
  { key: 'custom', label: 'Personnalisé' },
];

const METRICS: Array<{ key: Metric; label: string; dims: Dimension[] }> = [
  { key: 'revenue', label: 'CA (ventes)', dims: ['global', 'outlet', 'seller', 'product'] },
  { key: 'paid', label: 'Encaissé', dims: ['global', 'outlet', 'seller'] },
  { key: 'credit', label: 'À recouvrer', dims: ['global', 'outlet', 'seller'] },
  { key: 'count', label: 'Nb ventes', dims: ['global', 'outlet', 'seller'] },
  { key: 'qty', label: 'Quantités', dims: ['global', 'outlet', 'product'] },
  { key: 'expenses', label: 'Dépenses', dims: ['global', 'expense_category'] },
  { key: 'net', label: 'Net (encaissé − dépenses)', dims: ['global'] },
];

const DIMENSIONS: Array<{ key: Dimension; label: string }> = [
  { key: 'global', label: 'Vue globale' },
  { key: 'outlet', label: 'Par stand' },
  { key: 'seller', label: 'Par vendeur' },
  { key: 'product', label: 'Par produit' },
  { key: 'expense_category', label: 'Par catégorie de dépense' },
];

const COLORS = ['#b45309', '#059669', '#2563eb', '#dc2626', '#7c3aed', '#0891b2', '#ca8a04', '#be185d'];

function periodFor(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const today = iso(now);
  switch (preset) {
    case '7d': return { from: iso(addDays(now, -6)), to: today };
    case '30d': return { from: iso(addDays(now, -29)), to: today };
    case 'month': return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'lastMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(first), to: iso(last) };
    }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { from: iso(new Date(now.getFullYear(), q, 1)), to: today };
    }
    case 'year': return { from: iso(new Date(now.getFullYear(), 0, 1)), to: today };
    case 'custom': return { from: customFrom || today, to: customTo || today };
  }
}

function comparePeriod(mode: Compare, from: string, to: string): { from: string; to: string } | null {
  if (mode === 'none') return null;
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  if (mode === 'lastYear') {
    const f2 = new Date(f); f2.setFullYear(f2.getFullYear() - 1);
    const t2 = new Date(t); t2.setFullYear(t2.getFullYear() - 1);
    return { from: iso(f2), to: iso(t2) };
  }
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  return { from: iso(addDays(f, -days)), to: iso(addDays(f, -1)) };
}

function listDays(from: string, to: string): string[] {
  const out: string[] = [];
  let d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (d <= end && out.length < 740) { out.push(iso(d)); d = addDays(d, 1); }
  return out;
}

const dayLabel = (day: string) => {
  const d = new Date(day + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

// ---------------------------------------------------------------------------
// Multi-select (chips + panneau de cases à cocher) — mobile friendly

function MultiSelect({ label, options, selected, onChange }: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.size > 0 && selected.size < options.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={'px-3 py-1.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1 ' +
          (active ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}
      >
        {label}{active ? ` (${selected.size}/${options.length})` : ''}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-30 w-64 max-h-64 overflow-auto bg-white border border-gray-200 rounded-xl shadow-xl p-2">
            <div className="flex items-center justify-between px-1 pb-1.5 border-b mb-1">
              <button className="text-xs text-amber-700 font-semibold" onClick={() => onChange(new Set())}>Tout</button>
              <button className="text-xs text-gray-500" onClick={() => onChange(new Set(['∅']))}>Aucun</button>
            </div>
            {options.map(o => (
              <label key={o} className="flex items-center gap-2 px-1.5 py-1.5 rounded hover:bg-gray-50 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === 0 || selected.has(o)}
                  onChange={(e) => {
                    // « rien de sélectionné » = tout (état neutre)
                    const base = selected.size === 0 ? new Set(options) : new Set(selected);
                    base.delete('∅');
                    if (e.target.checked) base.add(o); else base.delete(o);
                    onChange(base.size === options.length ? new Set() : base);
                  }}
                  className="accent-amber-700"
                />
                <span className="truncate">{o}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function ReportsAnalyticsPage() {
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compare, setCompare] = useState<Compare>('none');
  const [metric, setMetric] = useState<Metric>('revenue');
  const [dimension, setDimension] = useState<Dimension>('global');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  // Mobile-first : les réglages avancés sont REPLIÉS — l'info d'abord
  const [showFilters, setShowFilters] = useState(false);
  const [outletFilter, setOutletFilter] = useState<Set<string>>(new Set());
  const [sellerFilter, setSellerFilter] = useState<Set<string>>(new Set());

  const [dataA, setDataA] = useState<Overview | null>(null);
  const [dataB, setDataB] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => periodFor(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const periodB = useMemo(() => comparePeriod(compare, period.from, period.to), [compare, period]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchOne = async (p: { from: string; to: string }): Promise<Overview> => {
        const r = await fetch(`/api/analytics/overview?from=${p.from}&to=${p.to}`);
        if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
        return (await r.json()).data;
      };
      const [a, b] = await Promise.all([
        fetchOne(period),
        periodB ? fetchOne(periodB) : Promise.resolve(null),
      ]);
      setDataA(a);
      setDataB(b);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period, periodB]);

  useEffect(() => { void load(); }, [load]);

  // ---- filtres multi-sélection ----
  const outletOptions = useMemo(
    () => [...new Set((dataA?.sales || []).map(s => s.outlet))].sort(),
    [dataA]
  );
  const sellerOptions = useMemo(
    () => [...new Set((dataA?.sales || []).map(s => s.seller))].sort(),
    [dataA]
  );
  const keepOutlet = useCallback(
    (o: string) => outletFilter.size === 0 || outletFilter.has(o),
    [outletFilter]
  );
  const keepSeller = useCallback(
    (s: string) => sellerFilter.size === 0 || sellerFilter.has(s),
    [sellerFilter]
  );

  const filterSales = useCallback(
    (rows: SalesFact[]) => rows.filter(r => keepOutlet(r.outlet) && keepSeller(r.seller)),
    [keepOutlet, keepSeller]
  );
  const filterProducts = useCallback(
    (rows: ProductFact[]) => rows.filter(r => keepOutlet(r.outlet)),
    [keepOutlet]
  );

  // ---- moteur d'agrégation (métrique × dimension × jour) ----
  const metricOf = useCallback((d: Overview | null, opts?: { day?: string; key?: string }): number => {
    if (!d) return 0;
    const dayOk = (x: { day: string }) => !opts?.day || x.day === opts.day;
    switch (metric) {
      case 'expenses':
        return d.expenses
          .filter(e => dayOk(e) && (!opts?.key || dimension !== 'expense_category' || e.category === opts.key))
          .reduce((s, e) => s + e.amount, 0);
      case 'net': {
        const paid = filterSales(d.sales).filter(dayOk).reduce((s, r) => s + r.paid, 0);
        const exp = d.expenses.filter(dayOk).reduce((s, e) => s + e.amount, 0);
        return paid - exp;
      }
      case 'qty':
      case 'revenue': {
        if (dimension === 'product' || metric === 'qty') {
          return filterProducts(d.products)
            .filter(p => dayOk(p)
              && (!opts?.key || dimension !== 'product' || p.product === opts.key)
              && (!opts?.key || dimension !== 'outlet' || p.outlet === opts.key))
            .reduce((s, p) => s + (metric === 'qty' ? p.qty : p.revenue), 0);
        }
        return filterSales(d.sales)
          .filter(r => dayOk(r)
            && (!opts?.key || dimension !== 'outlet' || r.outlet === opts.key)
            && (!opts?.key || dimension !== 'seller' || r.seller === opts.key))
          .reduce((s, r) => s + r.revenue, 0);
      }
      default: {
        const field = metric === 'paid' ? 'paid' : metric === 'credit' ? 'credit' : 'sales_count';
        return filterSales(d.sales)
          .filter(r => dayOk(r)
            && (!opts?.key || dimension !== 'outlet' || r.outlet === opts.key)
            && (!opts?.key || dimension !== 'seller' || r.seller === opts.key))
          .reduce((s, r) => s + (r as any)[field], 0);
      }
    }
  }, [metric, dimension, filterSales, filterProducts]);

  /** Valeurs de la dimension, triées par total décroissant sur la période A. */
  const dimensionKeys = useMemo((): string[] => {
    if (!dataA || dimension === 'global') return [];
    let keys: string[] = [];
    if (dimension === 'outlet') keys = [...new Set(filterSales(dataA.sales).map(r => r.outlet))];
    if (dimension === 'seller') keys = [...new Set(filterSales(dataA.sales).map(r => r.seller))];
    if (dimension === 'product') keys = [...new Set(filterProducts(dataA.products).map(r => r.product))];
    if (dimension === 'expense_category') keys = [...new Set(dataA.expenses.map(r => r.category))];
    return keys
      .map(k => ({ k, total: metricOf(dataA, { key: k }) }))
      .sort((a, b) => b.total - a.total)
      .map(x => x.k);
  }, [dataA, dimension, filterSales, filterProducts, metricOf]);

  const daysA = useMemo(() => listDays(period.from, period.to), [period]);
  const daysB = useMemo(() => (periodB ? listDays(periodB.from, periodB.to) : []), [periodB]);

  // ---- séries graphique ----
  const chartData = useMemo(() => {
    if (!dataA) return [];
    if (dimension === 'global') {
      // séries temporelles : A (+ B superposée, alignée par index de jour)
      return daysA.map((day, i) => ({
        label: dayLabel(day),
        ['Période']: metricOf(dataA, { day }),
        ...(dataB && daysB[i] ? { ['Comparaison']: metricOf(dataB, { day: daysB[i] }) } : {}),
      }));
    }
    if (compare !== 'none' && dataB) {
      // face-à-face A vs B par valeur de dimension (barres groupées)
      return dimensionKeys.slice(0, 12).map(k => ({
        label: k.length > 18 ? k.slice(0, 17) + '…' : k,
        ['Période']: metricOf(dataA, { key: k }),
        ['Comparaison']: metricOf(dataB, { key: k }),
      }));
    }
    // séries temporelles multi-réalités (top 6 + Autres)
    const top = dimensionKeys.slice(0, 6);
    const others = dimensionKeys.slice(6);
    return daysA.map(day => {
      const row: Record<string, any> = { label: dayLabel(day) };
      for (const k of top) row[k.length > 14 ? k.slice(0, 13) + '…' : k] = metricOf(dataA, { day, key: k });
      if (others.length > 0) {
        row['Autres'] = others.reduce((s, k) => s + metricOf(dataA, { day, key: k }), 0);
      }
      return row;
    });
  }, [dataA, dataB, dimension, compare, daysA, daysB, dimensionKeys, metricOf]);

  const chartSeries = useMemo((): string[] => {
    if (chartData.length === 0) return [];
    const keys = new Set<string>();
    for (const row of chartData) for (const k of Object.keys(row)) if (k !== 'label') keys.add(k);
    return [...keys];
  }, [chartData]);

  // Nombre de réglages avancés actifs (badge du bouton Filtres)
  const activeFilterCount =
    (compare !== 'none' ? 1 : 0) + (dimension !== 'global' ? 1 : 0) +
    (metric !== 'revenue' ? 1 : 0) + outletFilter.size + sellerFilter.size;

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const calc = (d: Overview | null) => {
      if (!d) return null;
      const sales = filterSales(d.sales);
      const revenue = sales.reduce((s, r) => s + r.revenue, 0);
      const paid = sales.reduce((s, r) => s + r.paid, 0);
      const credit = sales.reduce((s, r) => s + r.credit, 0);
      const count = sales.reduce((s, r) => s + r.sales_count, 0);
      const expenses = d.expenses.reduce((s, e) => s + e.amount, 0);
      return { revenue, paid, credit, count, basket: count ? revenue / count : 0, expenses, net: paid - expenses };
    };
    return { a: calc(dataA), b: calc(dataB) };
  }, [dataA, dataB, filterSales]);

  const metricsForDim = useMemo(() => METRICS.filter(m => m.dims.includes(dimension)), [dimension]);
  useEffect(() => {
    if (!metricsForDim.some(m => m.key === metric)) setMetric(metricsForDim[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension]);

  const delta = (a: number, b: number) => (b === 0 ? null : ((a - b) / Math.abs(b)) * 100);

  return (
    <ProtectedPage permission={PERMISSIONS.REPORTS_VIEW}>
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-amber-700" /> Rapports & Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Vue d'ensemble de l'activité — filtres croisés, périodes superposées
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/reports/annual"
              className="px-3 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold hover:bg-amber-800">
              Rapport annuel
            </a>
            <a href="/reports/financial"
              className="px-3 py-2 rounded-lg border border-amber-300 text-amber-800 text-sm font-semibold hover:bg-amber-50">
              Réglementaire
            </a>
            <button onClick={load} disabled={loading}
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50" aria-label="Rafraîchir">
              <RefreshCw className={'w-4 h-4 text-gray-600 ' + (loading ? 'animate-spin' : '')} />
            </button>
          </div>
        </div>

        {/* ===== Barre compacte : période + bouton Filtres ===== */}
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 flex-1">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => setPreset(p.key)}
                className={'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ' +
                  (preset === p.key ? 'bg-amber-700 text-white border-amber-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={'shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border ' +
              (showFilters || activeFilterCount > 0
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {/* ===== Réglages avancés : repliés par défaut ===== */}
        {showFilters && (
          <Card>
            <CardContent className="py-3 space-y-3">
              {preset === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5" />
                  <span className="text-gray-400">→</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5" />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select value={compare} onChange={e => setCompare(e.target.value as Compare)}
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
                  <option value="none">Sans comparaison</option>
                  <option value="previous">⇆ Superposer période précédente</option>
                  <option value="lastYear">⇆ Superposer l'an dernier</option>
                </select>
                <select value={dimension} onChange={e => setDimension(e.target.value as Dimension)}
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white">
                  {DIMENSIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {metricsForDim.map(m => (
                  <button key={m.key} onClick={() => setMetric(m.key)}
                    className={'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ' +
                      (metric === m.key ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}>
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <MultiSelect label="Stands" options={outletOptions} selected={outletFilter} onChange={setOutletFilter} />
                <MultiSelect label="Vendeurs" options={sellerOptions} selected={sellerFilter} onChange={setSellerFilter} />
                {(outletFilter.size > 0 || sellerFilter.size > 0) && (
                  <button onClick={() => { setOutletFilter(new Set()); setSellerFilter(new Set()); }}
                    className="text-xs text-gray-500 inline-flex items-center gap-1 hover:text-red-600">
                    <X className="w-3.5 h-3.5" /> Effacer filtres
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                Période : {period.from} → {period.to}
                {periodB && <> · comparée à {periodB.from} → {periodB.to}</>}
                {(metric === 'expenses' || metric === 'net')
                  ? ' · les dépenses sont globales au workspace (non filtrées par stand/vendeur)' : ''}
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        {/* ===== KPIs ===== */}
        {kpis.a && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {([
              ['CA', kpis.a.revenue, kpis.b?.revenue],
              ['Encaissé', kpis.a.paid, kpis.b?.paid],
              ['À recouvrer', kpis.a.credit, kpis.b?.credit],
              ['Ventes', kpis.a.count, kpis.b?.count],
              ['Panier moyen', kpis.a.basket, kpis.b?.basket],
              ['Net trésorerie', kpis.a.net, kpis.b?.net],
            ] as Array<[string, number, number | undefined]>).map(([label, a, b]) => {
              const d = b !== undefined ? delta(a, b) : null;
              return (
                <Card key={label}>
                  <CardContent className="py-3 px-3">
                    <p className="text-[10px] uppercase font-semibold text-gray-500">{label}</p>
                    <p className="text-lg font-bold tabular-nums leading-tight">{fmt(a)}</p>
                    {d !== null && (
                      <p className={'text-[11px] font-semibold inline-flex items-center gap-0.5 ' +
                        (d >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {d >= 0 ? '+' : ''}{d.toFixed(1)} %
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ===== Visualisation ===== */}
        <div className="flex justify-end -mb-2">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            <button onClick={() => setView('chart')}
              className={'px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 ' +
                (view === 'chart' ? 'bg-amber-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              <BarChart3 className="w-3.5 h-3.5" /> Graphique
            </button>
            <button onClick={() => setView('table')}
              className={'px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 border-l border-gray-300 ' +
                (view === 'table' ? 'bg-amber-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              <Table2 className="w-3.5 h-3.5" /> Tableau
            </button>
          </div>
        </div>
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="text-center py-20"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
            ) : !dataA || chartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-500">Aucune donnée sur la période.</p>
            ) : view === 'chart' ? (
              <div className="h-[320px] md:h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  {dimension !== 'global' && compare !== 'none' && dataB ? (
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={56} />
                      <YAxis tick={{ fontSize: 10 }} width={56} tickFormatter={(v: number) => fmt(v)} />
                      <Tooltip formatter={(v: any) => fmt(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Période" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Comparaison" fill="#9ca3af" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={56} tickFormatter={(v: number) => fmt(v)} />
                      <Tooltip formatter={(v: any) => fmt(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chartSeries.map((s, i) => (
                        <Line key={s} type="monotone" dataKey={s}
                          stroke={s === 'Comparaison' ? '#9ca3af' : COLORS[i % COLORS.length]}
                          strokeWidth={2} dot={false}
                          strokeDasharray={s === 'Comparaison' ? '6 4' : undefined} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              // ===== TABLEAU =====
              <div className="overflow-x-auto">
                {dimension === 'global' ? (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-gray-500">
                      <tr className="border-b">
                        <th className="text-left py-2 pr-3">Jour</th>
                        <th className="text-right py-2 px-2">{METRICS.find(m => m.key === metric)?.label}</th>
                        {dataB && <th className="text-right py-2 px-2">Comparaison</th>}
                        {dataB && <th className="text-right py-2 pl-2">Δ</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {daysA.map((day, i) => {
                        const a = metricOf(dataA, { day });
                        const b = dataB && daysB[i] ? metricOf(dataB, { day: daysB[i] }) : null;
                        const d = b !== null && b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
                        if (a === 0 && (b === null || b === 0)) return null;
                        return (
                          <tr key={day} className="border-b last:border-b-0 hover:bg-gray-50">
                            <td className="py-1.5 pr-3 whitespace-nowrap">{dayLabel(day)}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{fmt(a)}</td>
                            {dataB && <td className="py-1.5 px-2 text-right tabular-nums text-gray-500">{b !== null ? fmt(b) : '—'}</td>}
                            {dataB && (
                              <td className={'py-1.5 pl-2 text-right tabular-nums text-xs font-semibold ' +
                                (d === null ? 'text-gray-400' : d >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                {d === null ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(0)} %`}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-gray-500">
                      <tr className="border-b">
                        <th className="text-left py-2 pr-3">{DIMENSIONS.find(d => d.key === dimension)?.label.replace('Par ', '')}</th>
                        <th className="text-right py-2 px-2">{METRICS.find(m => m.key === metric)?.label}</th>
                        {dataB && <th className="text-right py-2 px-2">Comparaison</th>}
                        {dataB && <th className="text-right py-2 pl-2">Δ</th>}
                        <th className="text-right py-2 pl-2">Part</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const total = dimensionKeys.reduce((s, k) => s + metricOf(dataA, { key: k }), 0);
                        return dimensionKeys.map(k => {
                          const a = metricOf(dataA, { key: k });
                          const b = dataB ? metricOf(dataB, { key: k }) : null;
                          const d = b !== null && b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
                          return (
                            <tr key={k} className="border-b last:border-b-0 hover:bg-gray-50">
                              <td className="py-1.5 pr-3 max-w-[200px] truncate" title={k}>{k}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums font-semibold">{fmt(a)}</td>
                              {dataB && <td className="py-1.5 px-2 text-right tabular-nums text-gray-500">{b !== null ? fmt(b) : '—'}</td>}
                              {dataB && (
                                <td className={'py-1.5 pl-2 text-right tabular-nums text-xs font-semibold ' +
                                  (d === null ? 'text-gray-400' : d >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                  {d === null ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(0)} %`}
                                </td>
                              )}
                              <td className="py-1.5 pl-2 text-right tabular-nums text-xs text-gray-500">
                                {total > 0 ? ((a / total) * 100).toFixed(1) + ' %' : '—'}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
