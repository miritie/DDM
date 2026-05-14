'use client';

/**
 * État des stocks — vue matricielle produits × emplacements avec totaux.
 *
 * Modes :
 *   - matrix      : tableau croisé complet
 *   - byProduct   : focus produit (lignes = produits, totaux cumulés)
 *   - byLocation  : focus emplacement (lignes = emplacements)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { ArrowLeft, Loader2, Package, Building2, MapPin, Search, Calculator } from 'lucide-react';

interface OverviewData {
  products: Array<{ id: string; name: string; code: string }>;
  locations: Array<{ id: string; name: string; kind: 'warehouse' | 'outlet' }>;
  stock: Record<string, Record<string, { qty: number; totalValue: number }>>;
  totalsByProduct: Record<string, { qty: number; totalValue: number }>;
  totalsByLocation: Record<string, { qty: number; totalValue: number }>;
  grandTotal: { qty: number; totalValue: number; productsCount: number; locationsCount: number };
}

type Mode = 'matrix' | 'byProduct' | 'byLocation';

export default function StockOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('byProduct');
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState<'all' | 'warehouse' | 'outlet'>('all');
  const [recalculating, setRecalculating] = useState(false);

  function load() {
    setLoading(true);
    fetch('/api/stock/overview').then(r => r.json()).then(d => setData(d.data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function recalcCosts() {
    if (!confirm('Recalculer les coûts unitaires des lignes à 0 XOF ?\n\nPour chaque ligne sans coût, applique la moyenne pondérée des autres lignes du même produit, ou 50 % du prix de vente.')) return;
    setRecalculating(true);
    try {
      const r = await fetch('/api/stock/recalculate-costs', { method: 'POST' });
      const result = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(result?.error || `HTTP ${r.status}`);
      const d = result.data;
      alert(`✅ ${d.updated} ligne(s) corrigée(s) sur ${d.scanned} scannée(s).\n\nNouvelle valeur totale : ${Math.round(d.newTotalValue).toLocaleString('fr-FR')} XOF (${d.totalQty} unités)`);
      load();
    } catch (e: any) {
      alert(`❌ ${e.message}`);
    } finally { setRecalculating(false); }
  }

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    return data.products.filter(p =>
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const filteredLocations = useMemo(() => {
    if (!data) return [];
    return data.locations.filter(l => locationFilter === 'all' || l.kind === locationFilter);
  }, [data, locationFilter]);

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;
  if (!data) return <div className="p-6 text-red-600">Erreur de chargement</div>;

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Link href="/stock" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour au stock
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-600" /> État des stocks
          </h1>
          <div className="flex gap-2">
            <Link href="/stock/audit" className="px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-800 text-sm hover:bg-blue-100 inline-flex items-center gap-2">
              <Calculator className="w-4 h-4" /> Audit valorisation
            </Link>
            <button onClick={recalcCosts} disabled={recalculating}
              className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm hover:bg-amber-100 inline-flex items-center gap-2"
              title="Pour les lignes à coût unitaire 0, applique la moyenne pondérée du produit ou 50 % du prix de vente">
              <Calculator className="w-4 h-4" />
              {recalculating ? 'Recalcul…' : 'Recalculer coûts à 0'}
            </button>
          </div>
        </div>

        {/* KPIs globaux */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Produits actifs" value={String(data.grandTotal.productsCount)} />
          <KPI label="Emplacements" value={String(data.grandTotal.locationsCount)} />
          <KPI label="Quantité totale" value={data.grandTotal.qty.toLocaleString('fr-FR')} />
          <KPI label="Valeur totale" value={`${Math.round(data.grandTotal.totalValue).toLocaleString('fr-FR')} XOF`} highlight />
        </div>

        {/* Sélecteur de mode + filtres */}
        <div className="bg-white p-3 rounded-2xl border flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border overflow-hidden">
            <button onClick={() => setMode('byProduct')} className={`px-3 py-1.5 text-sm ${mode === 'byProduct' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
              Par produit
            </button>
            <button onClick={() => setMode('byLocation')} className={`px-3 py-1.5 text-sm ${mode === 'byLocation' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
              Par emplacement
            </button>
            <button onClick={() => setMode('matrix')} className={`px-3 py-1.5 text-sm ${mode === 'matrix' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
              Matrice complète
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border rounded" />
          </div>
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value as any)}
            className="px-3 py-1.5 text-sm border rounded">
            <option value="all">Tous emplacements</option>
            <option value="warehouse">Entrepôts</option>
            <option value="outlet">Points de vente</option>
          </select>
        </div>

        {mode === 'byProduct'   && <ByProductView data={data} products={filteredProducts} />}
        {mode === 'byLocation'  && <ByLocationView data={data} locations={filteredLocations} />}
        {mode === 'matrix'      && <MatrixView data={data} products={filteredProducts} locations={filteredLocations} />}
      </div>
    </ProtectedPage>
  );
}

function KPI({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border-2 ${highlight ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
      <div className="text-xs uppercase font-semibold text-gray-600">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${highlight ? 'text-emerald-800' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ByProductView({ data, products }: { data: OverviewData; products: OverviewData['products'] }) {
  return (
    <div className="bg-white rounded-2xl border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-3 py-2">Produit</th>
            <th className="text-right px-3 py-2 w-32">Quantité totale</th>
            <th className="text-right px-3 py-2 w-40">Valeur totale</th>
            <th className="text-left px-3 py-2">Répartition par emplacement</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map(p => {
            const totals = data.totalsByProduct[p.id] || { qty: 0, totalValue: 0 };
            const breakdown = data.locations
              .map(l => ({ loc: l, val: data.stock[p.id]?.[l.id] }))
              .filter(b => b.val && b.val.qty > 0);
            return (
              <tr key={p.id} className={totals.qty === 0 ? 'opacity-60' : ''}>
                <td className="px-3 py-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{p.code}</div>
                </td>
                <td className="px-3 py-2 text-right font-bold">{totals.qty.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-right">{Math.round(totals.totalValue).toLocaleString('fr-FR')} XOF</td>
                <td className="px-3 py-2">
                  {breakdown.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">aucun stock</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {breakdown.map(b => (
                        <span key={b.loc.id}
                          className={`text-xs px-2 py-0.5 rounded ${b.loc.kind === 'warehouse' ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-800'}`}
                          title={`${b.loc.name} (${b.loc.kind})`}>
                          {b.loc.name} : <strong>{b.val!.qty}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100 font-bold">
          <tr>
            <td className="px-3 py-2">TOTAL</td>
            <td className="px-3 py-2 text-right">{data.grandTotal.qty.toLocaleString('fr-FR')}</td>
            <td className="px-3 py-2 text-right">{Math.round(data.grandTotal.totalValue).toLocaleString('fr-FR')} XOF</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ByLocationView({ data, locations }: { data: OverviewData; locations: OverviewData['locations'] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {locations.map(l => {
        const totals = data.totalsByLocation[l.id] || { qty: 0, totalValue: 0 };
        const products = data.products
          .map(p => ({ p, s: data.stock[p.id]?.[l.id] }))
          .filter(x => x.s && x.s.qty > 0);
        return (
          <Link
            key={l.id}
            href={`/stock/locations/${l.kind}/${l.id}`}
            className="block bg-white p-4 rounded-2xl border hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {l.kind === 'warehouse'
                  ? <Building2 className="w-5 h-5 text-violet-600" />
                  : <MapPin className="w-5 h-5 text-amber-600" />}
                <h3 className="font-bold">{l.name}</h3>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${l.kind === 'warehouse' ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-800'}`}>
                {l.kind === 'warehouse' ? 'Entrepôt' : 'Stand'}
              </span>
            </div>
            <div className="text-xs text-gray-600 mb-3">
              {products.length} produit{products.length > 1 ? 's' : ''} · {totals.qty.toLocaleString('fr-FR')} unités · {Math.round(totals.totalValue).toLocaleString('fr-FR')} XOF
            </div>
            {products.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">Vide</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-auto">
                {products.map(({ p, s }) => (
                  <div key={p.id} className="flex justify-between text-sm py-1 border-b border-gray-100">
                    <span className="truncate">{p.name}</span>
                    <span className="font-bold text-gray-900 ml-2">{s!.qty}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-xs text-blue-600 font-medium">Voir le détail →</div>
          </Link>
        );
      })}
    </div>
  );
}

function MatrixView({ data, products, locations }: { data: OverviewData; products: OverviewData['products']; locations: OverviewData['locations'] }) {
  return (
    <div className="bg-white rounded-2xl border overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 border-b sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 z-10 border-r">Produit</th>
            {locations.map(l => (
              <th key={l.id} className="text-center px-2 py-2 min-w-[90px] border-r">
                <div className={`text-[10px] uppercase ${l.kind === 'warehouse' ? 'text-violet-700' : 'text-amber-700'}`}>
                  {l.kind === 'warehouse' ? 'Entrepôt' : 'Outlet'}
                </div>
                <div className="font-semibold text-xs">{l.name}</div>
              </th>
            ))}
            <th className="text-right px-3 py-2 bg-blue-50 font-bold">TOTAL</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {products.map(p => {
            const totals = data.totalsByProduct[p.id] || { qty: 0, totalValue: 0 };
            return (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r font-medium">{p.name}</td>
                {locations.map(l => {
                  const cell = data.stock[p.id]?.[l.id];
                  return (
                    <td key={l.id} className="px-2 py-2 text-center border-r text-sm">
                      {cell && cell.qty > 0
                        ? <span className="font-semibold">{cell.qty}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-bold bg-blue-50">{totals.qty.toLocaleString('fr-FR')}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-100 font-bold">
          <tr>
            <td className="px-3 py-2 sticky left-0 bg-gray-100 z-10 border-r">TOTAL emplacement</td>
            {locations.map(l => {
              const t = data.totalsByLocation[l.id] || { qty: 0 };
              return <td key={l.id} className="px-2 py-2 text-center border-r">{t.qty.toLocaleString('fr-FR')}</td>;
            })}
            <td className="px-3 py-2 text-right bg-emerald-100 text-emerald-900">{data.grandTotal.qty.toLocaleString('fr-FR')}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
