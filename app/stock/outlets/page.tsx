'use client';

/**
 * Page - Stocks par stand (liste des outlets avec accès direct à leur vue détaillée)
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  Store, ArrowLeft, Loader2, AlertTriangle, MapPin, Package, DollarSign, Search,
} from 'lucide-react';

interface OutletRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  typeName: string | null;
  isActive: boolean;
  totalQty: number;
  totalValue: number;
  linesWithStock: number;
  linesOut: number;
  linesLow: number;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' F';
}

export default function StockOutletsPage() {
  const router = useRouter();
  const [outlets, setOutlets] = useState<OutletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch('/api/stock/outlets');
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Erreur ${r.status}`);
      }
      const j = await r.json();
      setOutlets(j.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return outlets.filter(o => {
      if (!showInactive && !o.isActive) return false;
      if (!q) return true;
      return o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q) || (o.city || '').toLowerCase().includes(q);
    });
  }, [outlets, search, showInactive]);

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/stock" className="hover:text-blue-600">Stock</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">Stands</span>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Store className="w-7 h-7 text-blue-600" /> Stocks par stand
            </h1>
            <p className="text-gray-600 text-sm">Sélectionne un stand pour voir son stock complet, ses ruptures et ses mouvements.</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/stock')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un stand (nom, code, ville)…"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Inclure les stands inactifs
          </label>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : error ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-orange-500 mb-3" />
            <p className="text-gray-700">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-500">
            Aucun stand {search ? 'ne correspond à la recherche' : 'configuré pour ce workspace'}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(o => (
              <Link
                key={o.id}
                href={`/stock/locations/outlet/${o.id}`}
                className={`block bg-white rounded-xl shadow-sm border border-gray-100 hover:border-blue-400 hover:shadow-md transition-all p-5 ${!o.isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Store className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{o.name}</h3>
                      <p className="text-xs text-gray-500 font-mono">{o.slug}</p>
                    </div>
                  </div>
                  {!o.isActive && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 border border-gray-200">Inactif</span>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  {o.typeName && (
                    <div className="text-xs text-gray-500">{o.typeName}</div>
                  )}
                  {o.city && (
                    <div className="flex items-center gap-1 text-gray-600 text-xs">
                      <MapPin className="w-3 h-3" /> {o.city}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                    <div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Package className="w-3 h-3" /> Articles
                      </div>
                      <div className="font-semibold text-gray-900">{o.linesWithStock}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Valeur
                      </div>
                      <div className="font-semibold text-emerald-700">{formatCurrency(o.totalValue)}</div>
                    </div>
                  </div>
                  {(o.linesLow > 0 || o.linesOut > 0) && (
                    <div className="flex gap-2 pt-2 text-xs">
                      {o.linesLow > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                          {o.linesLow} faible{o.linesLow > 1 ? 's' : ''}
                        </span>
                      )}
                      {o.linesOut > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
                          {o.linesOut} rupture{o.linesOut > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
