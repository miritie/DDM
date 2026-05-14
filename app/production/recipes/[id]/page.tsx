'use client';

/**
 * Page - Détail d'une recette / formule
 *
 * Visibilité :
 * - recipe:view → ingrédients + quantités (besoins de production).
 * - recipe:view_formula (PCA + admin) → coût détaillé, marge, % ingrédients.
 */
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, ArrowLeft, Pencil, Save, X, AlertTriangle, Trash2, Plus,
  Beaker, Calendar, Clock, TrendingUp, Lock,
} from 'lucide-react';
import type { Recipe, RecipeLine, Ingredient, Product } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { usePermissions } from '@/lib/rbac/use-permissions';
import { PERMISSIONS } from '@/lib/rbac';

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));

interface CostBreakdown {
  totalCost: number;
  costPerUnit: number;
  ingredientCosts: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
}

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedPage permission={PERMISSIONS.RECIPE_VIEW}>
      <Content id={id} />
    </ProtectedPage>
  );
}

function Content({ id }: { id: string }) {
  const router = useRouter();
  const { permissions } = usePermissions();
  const canViewFormula = permissions.includes(PERMISSIONS.RECIPE_VIEW_FORMULA);
  const canEdit = permissions.includes(PERMISSIONS.RECIPE_EDIT);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [cost, setCost] = useState<CostBreakdown | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLine, setEditingLine] = useState<RecipeLine | null>(null);
  const [addingLine, setAddingLine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [recR, prodR, ingR] = await Promise.all([
        fetch(`/api/production/recipes/${id}`),
        fetch('/api/products?isActive=true'),
        fetch('/api/production/ingredients?isActive=true'),
      ]);
      if (!recR.ok) throw new Error('Recette introuvable');
      setRecipe((await recR.json()).data);
      setProducts(((await prodR.json()).data) || []);
      setIngredients(((await ingR.json()).data) || []);

      if (canViewFormula) {
        const costR = await fetch(`/api/production/recipes/${id}/cost`);
        if (costR.ok) setCost((await costR.json()).data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (permissions.length > 0 || !canViewFormula) load();
    else load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canViewFormula]);

  async function toggleActive() {
    if (!recipe) return;
    await fetch(`/api/production/recipes/${recipe.RecipeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !recipe.IsActive }),
    });
    load();
  }

  async function deleteLine(lineId: string) {
    if (!confirm('Supprimer cette ligne ?')) return;
    await fetch(`/api/production/recipes/${id}/lines?lineId=${lineId}`, { method: 'DELETE' });
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }
  if (!recipe) {
    return <div className="p-8 text-center text-gray-500">Recette introuvable.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-7 h-7" /> {recipe.Name}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
                <span className="bg-white/20 px-2 py-0.5 rounded">{recipe.RecipeNumber}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded">v{recipe.Version}</span>
                {recipe.ProductName && (
                  <span className="bg-white/20 px-2 py-0.5 rounded">→ {recipe.ProductName}</span>
                )}
                {!recipe.IsActive && <span className="bg-red-500/40 px-2 py-0.5 rounded">Inactive</span>}
              </div>
            </div>
            {canEdit && (
              <Button onClick={toggleActive} variant="outline" className="bg-white/20 hover:bg-white/30 border-white/40 text-white">
                {recipe.IsActive ? 'Désactiver' : 'Activer'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 text-gray-500 text-sm"><Beaker className="w-4 h-4" /> Sortie</div>
              <p className="text-2xl font-bold">{fmt(recipe.OutputQuantity)} <span className="text-sm font-normal text-gray-500">{recipe.OutputUnit}</span></p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 text-gray-500 text-sm"><Clock className="w-4 h-4" /> Durée</div>
              <p className="text-2xl font-bold">{recipe.EstimatedDuration || '—'} <span className="text-sm font-normal text-gray-500">min</span></p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 text-gray-500 text-sm"><TrendingUp className="w-4 h-4" /> Rendement</div>
              <p className="text-2xl font-bold">{recipe.YieldRate}<span className="text-sm font-normal text-gray-500">%</span></p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 text-gray-500 text-sm"><FileText className="w-4 h-4" /> Lignes</div>
              <p className="text-2xl font-bold">{recipe.Lines?.length || 0}</p>
            </div>
          </div>
        </div>

        {recipe.Instructions && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold mb-2">Instructions</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{recipe.Instructions}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Beaker className="w-5 h-5 text-purple-600" />
              Ingrédients ({recipe.Lines?.length || 0})
              {!canViewFormula && (
                <span title="Formule détaillée masquée — permission recipe:view_formula requise" className="ml-2">
                  <Lock className="w-4 h-4 text-gray-400" />
                </span>
              )}
            </h2>
            {canEdit && (
              <Button onClick={() => setAddingLine(true)} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Ligne
              </Button>
            )}
          </div>

          {!recipe.Lines || recipe.Lines.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">Aucun ingrédient.</div>
          ) : (
            <div className="divide-y">
              {recipe.Lines.map((line) => {
                const lineCost = cost?.ingredientCosts.find(
                  (c) => c.ingredientName === line.IngredientName
                );
                return (
                  <div key={line.id} className="py-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                      <Beaker className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{line.IngredientName}</p>
                      <p className="text-sm text-gray-600">
                        {fmt(line.Quantity)} {line.Unit}
                        {line.Loss && Number(line.Loss) > 0 && <span className="ml-2 text-orange-600">−{line.Loss}% perte</span>}
                        {canViewFormula && lineCost && (
                          <span className="ml-2 text-purple-700 font-semibold">
                            · {fmt(lineCost.totalCost)} XOF
                          </span>
                        )}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button onClick={() => setEditingLine(line)} className="p-2 hover:bg-purple-50 rounded">
                          <Pencil className="w-4 h-4 text-purple-600" />
                        </button>
                        <button onClick={() => deleteLine(line.RecipeLineId)} className="p-2 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Can permission={PERMISSIONS.RECIPE_VIEW_FORMULA}>
          {cost && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4">
              <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Coût matière (PMP courant)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-purple-700">Coût total ({fmt(recipe.OutputQuantity)} {recipe.OutputUnit})</p>
                  <p className="text-2xl font-bold text-purple-900">{fmt(cost.totalCost)} XOF</p>
                </div>
                <div>
                  <p className="text-xs text-purple-700">Coût par unité produite</p>
                  <p className="text-2xl font-bold text-purple-900">{fmt(cost.costPerUnit)} XOF</p>
                </div>
              </div>
              <p className="text-xs text-purple-700 mt-2">
                Recalculé à chaque évolution des PMP. Hors main d'œuvre, énergie, conditionnement.
              </p>
            </div>
          )}
        </Can>
      </div>

      {(addingLine || editingLine) && (
        <LineModal
          recipeId={recipe.RecipeId}
          line={editingLine}
          ingredients={ingredients}
          onClose={() => { setAddingLine(false); setEditingLine(null); }}
          onSaved={() => { setAddingLine(false); setEditingLine(null); load(); }}
        />
      )}
    </div>
  );
}

function LineModal({
  recipeId, line, ingredients, onClose, onSaved,
}: {
  recipeId: string;
  line: RecipeLine | null;
  ingredients: Ingredient[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    ingredientId: line?.IngredientId ?? '',
    quantity: line ? String(line.Quantity) : '',
    unit: line?.Unit ?? '',
    loss: line ? String(line.Loss ?? 0) : '0',
    notes: line?.Notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const INP = 'w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500';

  async function save() {
    if (!form.ingredientId || !form.quantity) {
      setError('Ingrédient et quantité requis');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (line) {
        // Update
        const r = await fetch(`/api/production/recipes/${recipeId}/lines?lineId=${line.RecipeLineId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: Number(form.quantity),
            unit: form.unit,
            loss: Number(form.loss) || 0,
            notes: form.notes || undefined,
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      } else {
        // Add
        const ing = ingredients.find((i) => i.IngredientId === form.ingredientId);
        const r = await fetch(`/api/production/recipes/${recipeId}/lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredientId: form.ingredientId,
            quantity: Number(form.quantity),
            unit: form.unit || ing?.Unit || 'g',
            loss: Number(form.loss) || 0,
            notes: form.notes || undefined,
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      }
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{line ? 'Modifier la ligne' : 'Ajouter une ligne'}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
          {!line ? (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Ingrédient*</span>
              <select className={INP} value={form.ingredientId} onChange={(e) => {
                const ing = ingredients.find((i) => i.IngredientId === e.target.value);
                setForm({ ...form, ingredientId: e.target.value, unit: form.unit || ing?.Unit || '' });
              }}>
                <option value="">— Choisir —</option>
                {ingredients.map((i) => (
                  <option key={i.IngredientId} value={i.IngredientId}>{i.Name}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm bg-gray-50 p-3 rounded-lg">
              <strong>Ingrédient :</strong> {line.IngredientName}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Quantité*</span>
              <input type="number" min="0" step="0.001" className={INP} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Unité</span>
              <input className={INP} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">% perte</span>
            <input type="number" min="0" max="100" step="0.1" className={INP} value={form.loss} onChange={(e) => setForm({ ...form, loss: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Notes</span>
            <textarea className={INP + ' h-auto py-2'} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
          <Button onClick={save} disabled={busy} className="flex-1 h-11 bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-1" /> {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
