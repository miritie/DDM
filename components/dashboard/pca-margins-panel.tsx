'use client';

/**
 * Composant - Vue marges PCA (confidentielle)
 *
 * Affiche le top/bottom des marges produits + alertes MP, à partir de
 * /api/dashboard/pca-margins (guard recipe:view_formula).
 */
import { useEffect, useState } from 'react';
import {
  Lock, TrendingUp, TrendingDown, AlertTriangle, Beaker, RefreshCw,
} from 'lucide-react';

interface MarginRow {
  RecipeId: string;
  RecipeName: string;
  ProductName: string;
  UnitPrice: number;
  OutputQty: number;
  YieldRate: number;
  TotalMaterialCost: number;
  CostPerUnit: number;
  MarginPerUnit: number;
  MarginRate: number;
}

interface Data {
  margins: MarginRow[];
  topMargins: MarginRow[];
  bottomMargins: MarginRow[];
  ingredientsBelowMinimum: any[];
  totalStockValue: number;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

export function PCAMarginsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/dashboard/pca-margins', { cache: 'no-store' });
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
      <div className="bg-white rounded-2xl shadow border-2 border-purple-200 p-6">
        <div className="flex items-center gap-2 text-purple-700">
          <RefreshCw className="w-4 h-4 animate-spin" /> Calcul des marges…
        </div>
      </div>
    );
  }
  if (error || !data) {
    return null; // silencieux si permission manquante
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-5 h-5 text-purple-700" />
          <h2 className="font-bold text-purple-900">Marges produits — confidentiel</h2>
        </div>
        <p className="text-sm text-purple-700 mb-4">
          Basé sur les recettes actives × PMP courants. {data.margins.length} produit{data.margins.length > 1 ? 's' : ''} en référentiel.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top marges */}
          <div className="bg-white rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Top marges</h3>
            </div>
            {data.topMargins.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">—</p>
            ) : (
              <div className="space-y-2">
                {data.topMargins.map((m) => (
                  <MarginRow key={m.RecipeId} m={m} tone="green" />
                ))}
              </div>
            )}
          </div>

          {/* Bottom marges (alertes) */}
          <div className="bg-white rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-900">Marges faibles / négatives</h3>
            </div>
            {data.bottomMargins.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Aucun produit en alerte.</p>
            ) : (
              <div className="space-y-2">
                {data.bottomMargins.map((m) => (
                  <MarginRow key={m.RecipeId} m={m} tone="red" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alertes MP */}
      {data.ingredientsBelowMinimum.length > 0 && (
        <div className="bg-white rounded-2xl shadow border-2 border-orange-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-orange-900">Matières premières sous le seuil</h3>
            <span className="ml-auto text-sm font-semibold text-orange-700">
              {data.ingredientsBelowMinimum.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.ingredientsBelowMinimum.map((ing: any) => (
              <a
                key={ing.IngredientId}
                href={`/production/ingredients/${ing.IngredientId}`}
                className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 rounded-lg p-2 text-sm"
              >
                <Beaker className="w-4 h-4 text-orange-600 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{ing.Name}</p>
                  <p className="text-xs text-gray-600">
                    {fmt(Number(ing.CurrentStock))} {ing.Unit} <span className="text-orange-700">/ min {fmt(Number(ing.MinimumStock))}</span>
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Valeur stock MP */}
      <div className="bg-white rounded-2xl shadow border p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Valeur stock matières premières</p>
          <p className="text-2xl font-bold">{fmt(data.totalStockValue)} XOF</p>
        </div>
        <Beaker className="w-10 h-10 text-blue-300" />
      </div>
    </div>
  );
}

function MarginRow({ m, tone }: { m: MarginRow; tone: 'green' | 'red' }) {
  const cls = tone === 'green' ? 'text-green-700' : 'text-red-700';
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{m.ProductName}</p>
        <p className="text-xs text-gray-500 truncate">
          PV {fmt(m.UnitPrice)} − coût matière {fmt(m.CostPerUnit)} = {fmt(m.MarginPerUnit)}
        </p>
      </div>
      <span className={`font-bold ${cls} shrink-0`}>{pct(m.MarginRate)}</span>
    </div>
  );
}
