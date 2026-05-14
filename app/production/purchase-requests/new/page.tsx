'use client';

/**
 * Page - Nouvelle sollicitation d'achat MP
 *
 * Manager production (ou manager_compta_stocks) compose une sollicitation
 * multi-lignes (chaque ligne = un ingrédient × qty × prix estimé).
 * À soumettre pour validation admin (qui débloquera les fonds via expense auto).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, Save, ShoppingCart, AlertTriangle, Beaker, Send,
} from 'lucide-react';
import type { Ingredient } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';

const INP = 'w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-500';
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

interface LineDraft {
  ingredientId: string;
  qtyRequested: string;
  unit: string;
  estimatedUnitPrice: string;
  notes: string;
}

export default function NewPurchaseRequestPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.PURCHASE_REQUEST_CREATE}>
      <Content />
    </ProtectedPage>
  );
}

function Content() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/production/ingredients?isActive=true')
      .then((r) => r.json())
      .then((d) => setIngredients(d.data || []));
  }, []);

  function addLine(ingredientId?: string) {
    const ing = ingredientId ? ingredients.find((i) => i.IngredientId === ingredientId) : null;
    setLines([
      ...lines,
      {
        ingredientId: ingredientId ?? '',
        qtyRequested: '',
        unit: ing?.Unit ?? '',
        estimatedUnitPrice: ing ? String(ing.UnitCost) : '',
        notes: '',
      },
    ]);
  }
  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }
  function update(idx: number, patch: Partial<LineDraft>) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  const ingMap = new Map(ingredients.map((i) => [i.IngredientId, i]));
  const totalEstimated = lines.reduce((s, l) => {
    if (!l.qtyRequested || !l.estimatedUnitPrice) return s;
    return s + Number(l.qtyRequested) * Number(l.estimatedUnitPrice);
  }, 0);

  async function createAndSubmit(submit: boolean) {
    setError(null);
    if (lines.length === 0) {
      setError('Ajoutez au moins une ligne d\'ingrédient.');
      return;
    }
    if (lines.some((l) => !l.ingredientId || !l.qtyRequested || !l.estimatedUnitPrice)) {
      setError('Chaque ligne doit avoir un ingrédient, une quantité et un prix estimé.');
      return;
    }

    setBusy(true);
    try {
      const r = await fetch('/api/production/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          lines: lines.map((l) => ({
            ingredientId: l.ingredientId,
            qtyRequested: Number(l.qtyRequested),
            unit: l.unit || ingMap.get(l.ingredientId)?.Unit || 'unit',
            estimatedUnitPrice: Number(l.estimatedUnitPrice),
            notes: l.notes || undefined,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur création');

      if (submit) {
        const sR = await fetch(`/api/production/purchase-requests/${data.data.ExpenseRequestId}/submit`, {
          method: 'POST',
        });
        if (!sR.ok) {
          // Création OK mais submit échoué : on emmène sur la fiche pour retry
          router.push(`/production/purchase-requests/${data.data.ExpenseRequestId}`);
          return;
        }
      }
      router.push(`/production/purchase-requests/${data.data.ExpenseRequestId}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-7 h-7" /> Nouvelle sollicitation d'achat MP
          </h1>
          <p className="text-sm opacity-90 mt-1">
            À l'approbation par l'admin, une dépense sera automatiquement créée (déblocage des fonds).
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="font-bold">Informations</h2>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Titre (optionnel)</span>
            <input className={INP} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Réappro matières — semaine 20" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Description / motif</span>
            <textarea className={INP + ' h-auto py-2'} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Beaker className="w-5 h-5 text-amber-600" /> Lignes d'achat
            </h2>
            <Button onClick={() => addLine()} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Ligne vide
            </Button>
          </div>

          {ingredients.length > 0 && lines.length === 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Raccourci : sous le minimum →</p>
              <div className="flex flex-wrap gap-2">
                {ingredients
                  .filter((i) => Number(i.CurrentStock) < Number(i.MinimumStock))
                  .map((i) => (
                    <button
                      key={i.IngredientId}
                      onClick={() => addLine(i.IngredientId)}
                      className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm hover:bg-orange-200 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" /> {i.Name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {lines.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">
              Ajoutez des lignes pour composer la sollicitation.
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const ing = ingMap.get(line.ingredientId);
                const sub = line.qtyRequested && line.estimatedUnitPrice
                  ? Number(line.qtyRequested) * Number(line.estimatedUnitPrice)
                  : 0;
                return (
                  <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <div className="col-span-12 sm:col-span-5">
                          <select
                            className={INP + ' text-sm'}
                            value={line.ingredientId}
                            onChange={(e) => {
                              const newIng = ingMap.get(e.target.value);
                              update(idx, {
                                ingredientId: e.target.value,
                                unit: line.unit || newIng?.Unit || '',
                                estimatedUnitPrice: line.estimatedUnitPrice || (newIng ? String(newIng.UnitCost) : ''),
                              });
                            }}
                          >
                            <option value="">— Ingrédient —</option>
                            {ingredients.map((i) => (
                              <option key={i.IngredientId} value={i.IngredientId}>{i.Name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="number" min="0" step="0.001"
                            className={INP + ' text-sm'}
                            placeholder="Qté"
                            value={line.qtyRequested}
                            onChange={(e) => update(idx, { qtyRequested: e.target.value })}
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            className={INP + ' text-sm'}
                            placeholder="Unité"
                            value={line.unit}
                            onChange={(e) => update(idx, { unit: e.target.value })}
                          />
                        </div>
                        <div className="col-span-5 sm:col-span-3">
                          <input
                            type="number" min="0" step="0.01"
                            className={INP + ' text-sm'}
                            placeholder="Prix unit."
                            value={line.estimatedUnitPrice}
                            onChange={(e) => update(idx, { estimatedUnitPrice: e.target.value })}
                          />
                        </div>
                      </div>
                      <button onClick={() => removeLine(idx)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                    {(ing && sub > 0) && (
                      <div className="text-xs text-gray-600 flex justify-between">
                        <span>Stock actuel: {fmt(Number(ing.CurrentStock))} {ing.Unit} (min {fmt(Number(ing.MinimumStock))})</span>
                        <span className="font-semibold">Sous-total: {fmt(sub)} XOF</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalEstimated > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-amber-700">Total estimé</p>
                <p className="text-3xl font-bold text-amber-900">{fmt(totalEstimated)} XOF</p>
              </div>
              <p className="text-xs text-amber-700 max-w-xs text-right">
                Ce montant sera engagé en expense à l'approbation par l'admin.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Button variant="outline" onClick={() => router.back()} className="flex-1 h-12">Annuler</Button>
          <Button onClick={() => createAndSubmit(false)} disabled={busy} className="flex-1 h-12">
            <Save className="w-5 h-5 mr-1" /> Brouillon
          </Button>
          <Button onClick={() => createAndSubmit(true)} disabled={busy} className="flex-1 h-12 bg-amber-600 hover:bg-amber-700">
            <Send className="w-5 h-5 mr-1" /> {busy ? '…' : 'Soumettre'}
          </Button>
        </div>
      </div>
    </div>
  );
}
