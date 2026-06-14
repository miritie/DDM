'use client';

/**
 * Page — Inventaire des matières premières
 *
 * Permet à un manager production / comptable / admin de compter physiquement
 * les ingrédients en stock et d'ajuster les niveaux théoriques aux niveaux
 * réels. Chaque ajustement est tracé dans ingredient_adjustments.
 *
 * UI : 1 ligne par ingrédient, saisie du compté → calcul auto de l'écart →
 * bouton "Enregistrer" qui pousse l'ajustement.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Beaker, Save, History, Loader2, AlertTriangle, Check, RotateCw,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';

interface Ingredient {
  Id?: string;
  id?: string;
  IngredientId?: string;
  Name: string;
  Code?: string;
  Unit: string;
  CurrentStock: number | string;
}

interface AdjustmentRow {
  id: string;
  adjustment_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  qty_delta: number | string;
  stock_before: number | string;
  stock_after: number | string;
  reason: string | null;
  processed_at: string;
  processed_by_name: string | null;
}

const fmt = (n: number | string) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(Number(n));

function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function IngredientInventoryPage() {
  return (
    <ProtectedPage permissions={[PERMISSIONS.INGREDIENT_INVENTORY, PERMISSIONS.PRODUCTION_EDIT]}>
      <Content />
    </ProtectedPage>
  );
}

function Content() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AdjustmentRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [iR, hR] = await Promise.all([
        fetch('/api/production/ingredients?isActive=true').then(r => r.json()),
        fetch('/api/production/ingredients/adjustments?limit=20').then(r => r.json()),
      ]);
      setIngredients(iR.data || []);
      setHistory(hR.data || []);
      setSavedIds(new Set());
      setCounts({});
      setReasons({});
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function submitAdjustment(ing: Ingredient) {
    const ingId = (ing.IngredientId || ing.Id || ing.id) as string;
    const raw = counts[ingId];
    if (raw === undefined || raw === '') return;
    const counted = Number(raw);
    if (Number.isNaN(counted) || counted < 0) {
      setError(`Quantité invalide pour ${ing.Name}`);
      return;
    }
    setSavingId(ingId);
    setError(null);
    try {
      const r = await fetch('/api/production/ingredients/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: ingId,
          countedStock: counted,
          reason: reasons[ingId] || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setSavedIds(curr => new Set([...curr, ingId]));
      // Recharger pour mettre à jour le current_stock
      const iR = await fetch('/api/production/ingredients?isActive=true').then(r => r.json());
      setIngredients(iR.data || []);
      const hR = await fetch('/api/production/ingredients/adjustments?limit=20').then(r => r.json());
      setHistory(hR.data || []);
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Beaker className="w-7 h-7" /> Inventaire matières premières
            </h1>
            <Button onClick={load} variant="outline" className="bg-white/20 border-white/40 text-white hover:bg-white/30">
              <RotateCw className="w-4 h-4 mr-1" /> Rafraîchir
            </Button>
          </div>
          <p className="text-sm opacity-90 mt-1">
            Saisis la quantité physique. L'écart est calculé et appliqué automatiquement, avec audit trail.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="font-bold">{ingredients.length} matières premières · saisie ligne par ligne</p>
            </div>
            <div className="divide-y">
              {ingredients.map(ing => {
                const ingId = (ing.IngredientId || ing.Id || ing.id) as string;
                const theoretical = Number(ing.CurrentStock);
                const countedRaw = counts[ingId];
                const counted = countedRaw === undefined || countedRaw === '' ? null : Number(countedRaw);
                const delta = counted === null ? null : +(counted - theoretical).toFixed(3);
                const saved = savedIds.has(ingId);
                const isSaving = savingId === ingId;
                return (
                  <div key={ingId} className="p-3 sm:p-4">
                    {/* Nom + théorique */}
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <p className="font-semibold text-sm truncate">{ing.Name}</p>
                      <p className="text-xs text-gray-500 shrink-0">
                        théo. <strong>{fmt(theoretical)} {ing.Unit}</strong>
                      </p>
                    </div>
                    {/* Compté (grand) + écart */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <input
                          type="number" min={0} step={0.001} inputMode="decimal"
                          placeholder="Quantité comptée"
                          value={countedRaw ?? ''}
                          onChange={(e) => setCounts(c => ({ ...c, [ingId]: e.target.value }))}
                          className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-base text-right tabular-nums focus:border-amber-400"
                        />
                      </div>
                      <div className={`w-20 text-center text-sm font-bold tabular-nums ${
                        delta === null ? 'text-gray-300' :
                        delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-gray-400'
                      }`}>
                        {delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmt(delta)}`}
                      </div>
                    </div>
                    {/* Raison + enregistrer (n'apparaît que s'il y a un écart) */}
                    {delta !== null && delta !== 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text" placeholder="Raison : perte, casse…"
                          value={reasons[ingId] ?? ''}
                          onChange={(e) => setReasons(r => ({ ...r, [ingId]: e.target.value }))}
                          className="flex-1 h-10 px-3 border-2 border-gray-200 rounded-xl text-sm"
                        />
                        <button
                          onClick={() => submitAdjustment(ing)}
                          disabled={isSaving}
                          className={`h-10 px-4 rounded-xl text-white font-bold text-sm inline-flex items-center gap-1.5 disabled:opacity-50 ${saved ? 'bg-green-600' : 'bg-amber-600 hover:bg-amber-700'}`}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <><Save className="w-4 h-4" /> OK</>}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Historique des derniers ajustements */}
        <div className="bg-white rounded-2xl shadow-xl">
          <button
            onClick={() => setShowHistory(s => !s)}
            className="w-full px-4 py-3 border-b flex items-center justify-between bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-gray-600" />
              <span className="font-bold">Historique récent ({history.length})</span>
            </div>
            <span className="text-xs text-gray-500">{showHistory ? 'Masquer' : 'Afficher'}</span>
          </button>
          {showHistory && (
            history.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">Aucun ajustement enregistré.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {history.map(h => {
                  const d = Number(h.qty_delta);
                  return (
                    <div key={h.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{h.ingredient_name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {fmtDateTime(h.processed_at)}
                          {h.reason ? ` · ${h.reason}` : ''}
                          {h.processed_by_name ? ` · ${h.processed_by_name}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${d > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {d > 0 ? '+' : ''}{fmt(d)}
                        </p>
                        <p className="text-[11px] text-gray-400 tabular-nums">{fmt(h.stock_before)} → {fmt(h.stock_after)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
