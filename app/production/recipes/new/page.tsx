'use client';

/**
 * Page - Création d'une recette / formule (PCA + admin uniquement).
 *
 * Sélectionne un produit, ajoute les lignes d'ingrédients, voit le coût
 * matière estimé en temps réel via les PMP courants.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, X, Save, FileText, Beaker, AlertTriangle, Trash2,
} from 'lucide-react';
import type { Ingredient, Product } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const INP = 'w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500';

interface LineDraft {
  ingredientId: string;
  quantity: string;
  unit: string;
  loss: string;
  notes: string;
}

export default function NewRecipePage() {
  return (
    <ProtectedPage permission={PERMISSIONS.RECIPE_EDIT}>
      <NewRecipeContent />
    </ProtectedPage>
  );
}

function NewRecipeContent() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [form, setForm] = useState({
    name: '',
    productId: '',
    outputQuantity: '',
    outputUnit: 'pcs',
    estimatedDuration: '',
    yieldRate: '95',
    instructions: '',
  });
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products?isActive=true').then((r) => r.json()),
      fetch('/api/production/ingredients?isActive=true').then((r) => r.json()),
    ]).then(([p, i]) => {
      setProducts(p.data || []);
      setIngredients(i.data || []);
    });
  }, []);

  function addLine() {
    setLines([...lines, { ingredientId: '', quantity: '', unit: '', loss: '0', notes: '' }]);
  }
  function removeLine(idx: number) {
    setLines(lines.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  // Coût matière estimé (live)
  const ingMap = new Map(ingredients.map((i) => [i.IngredientId, i]));
  let totalCost = 0;
  const lineCosts: number[] = lines.map((l) => {
    const ing = ingMap.get(l.ingredientId);
    if (!ing || !l.quantity) return 0;
    const c = Number(l.quantity) * Number(ing.UnitCost);
    totalCost += c;
    return c;
  });
  const costPerUnit = Number(form.outputQuantity) > 0 ? totalCost / Number(form.outputQuantity) : 0;

  async function submit() {
    setError(null);
    if (!form.name.trim() || !form.productId || !form.outputQuantity) {
      setError('Nom, produit fini et quantité produite sont requis.');
      return;
    }
    if (lines.length === 0) {
      setError('Ajoutez au moins une ligne d\'ingrédient.');
      return;
    }
    if (lines.some((l) => !l.ingredientId || !l.quantity)) {
      setError('Chaque ligne doit avoir un ingrédient et une quantité.');
      return;
    }

    setBusy(true);
    try {
      const r = await fetch('/api/production/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          productId: form.productId,
          outputQuantity: Number(form.outputQuantity),
          outputUnit: form.outputUnit,
          estimatedDuration: form.estimatedDuration ? Number(form.estimatedDuration) : undefined,
          yieldRate: Number(form.yieldRate) || 100,
          instructions: form.instructions.trim() || undefined,
          lines: lines.map((l) => {
            const ing = ingMap.get(l.ingredientId);
            return {
              ingredientId: l.ingredientId,
              quantity: Number(l.quantity),
              unit: l.unit || ing?.Unit || 'g',
              loss: Number(l.loss) || 0,
              notes: l.notes || undefined,
            };
          }),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur création');
      router.push(`/production/recipes/${data.data.RecipeId}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7" /> Nouvelle recette
          </h1>
          <p className="text-sm opacity-90 mt-1">Formule de fabrication — confidentielle PCA/Admin</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-3">
          <h2 className="font-bold">Informations générales</h2>
          <Field label="Nom de la recette*">
            <input className={INP} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: 7ÈME — formule standard" />
          </Field>
          <Field label="Produit fini*">
            <select className={INP} value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">— Choisir un produit —</option>
              {products.map((p) => (
                <option key={p.ProductId} value={p.ProductId}>{p.Name} ({p.Code})</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantité produite (par lot)*">
              <input type="number" min="0" step="0.001" className={INP} value={form.outputQuantity} onChange={(e) => setForm({ ...form, outputQuantity: e.target.value })} placeholder="ex: 10000" />
            </Field>
            <Field label="Unité de sortie">
              <input className={INP} value={form.outputUnit} onChange={(e) => setForm({ ...form, outputUnit: e.target.value })} placeholder="pcs, sachets, g…" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Durée estimée (min)">
              <input type="number" min="0" className={INP} value={form.estimatedDuration} onChange={(e) => setForm({ ...form, estimatedDuration: e.target.value })} />
            </Field>
            <Field label="Rendement attendu (%)">
              <input type="number" min="0" max="100" step="0.1" className={INP} value={form.yieldRate} onChange={(e) => setForm({ ...form, yieldRate: e.target.value })} />
            </Field>
          </div>
          <Field label="Instructions de fabrication">
            <textarea className={INP + ' h-auto py-2'} rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </Field>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><Beaker className="w-5 h-5 text-purple-600" /> Ingrédients</h2>
            <Button onClick={addLine} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>

          {lines.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">
              Aucun ingrédient. Cliquez sur « Ajouter » pour composer la recette.
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const ing = ingMap.get(line.ingredientId);
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
                              updateLine(idx, {
                                ingredientId: e.target.value,
                                unit: line.unit || newIng?.Unit || 'g',
                              });
                            }}
                          >
                            <option value="">— Ingrédient —</option>
                            {ingredients.map((i) => (
                              <option key={i.IngredientId} value={i.IngredientId}>
                                {i.Name} {i.Kind === 'semi' ? '(semi)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-5 sm:col-span-3">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            className={INP + ' text-sm'}
                            placeholder="Qté"
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            className={INP + ' text-sm'}
                            placeholder="Unité"
                            value={line.unit}
                            onChange={(e) => updateLine(idx, { unit: e.target.value })}
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            className={INP + ' text-sm'}
                            placeholder="% perte"
                            value={line.loss}
                            onChange={(e) => updateLine(idx, { loss: e.target.value })}
                          />
                        </div>
                      </div>
                      <button onClick={() => removeLine(idx)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                    {ing && lineCosts[idx] > 0 && (
                      <div className="text-xs text-gray-600 flex justify-between">
                        <span>PMP {fmt(Number(ing.UnitCost))} {ing.Currency}/{ing.Unit}</span>
                        <span className="font-semibold">≈ {fmt(lineCosts[idx])} {ing.Currency}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalCost > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4">
            <h3 className="font-bold text-purple-900 mb-2">Coût matière estimé</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-purple-700">Coût total pour {form.outputQuantity || 0} {form.outputUnit}</p>
                <p className="text-2xl font-bold text-purple-900">{fmt(totalCost)} XOF</p>
              </div>
              <div>
                <p className="text-xs text-purple-700">Coût par unité produite</p>
                <p className="text-2xl font-bold text-purple-900">{fmt(costPerUnit)} XOF</p>
              </div>
            </div>
            <p className="text-xs text-purple-700 mt-2">
              Basé sur les PMP courants. Hors rendement {form.yieldRate}% et perte unitaire.
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Button variant="outline" onClick={() => router.back()} className="flex-1 h-12">Annuler</Button>
          <Button onClick={submit} disabled={busy} className="flex-1 h-12 bg-purple-600 hover:bg-purple-700">
            <Save className="w-5 h-5 mr-1" /> {busy ? 'Création…' : 'Créer la recette'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
