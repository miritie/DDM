'use client';

/**
 * Page - Matières Premières / Ingrédients
 *
 * Liste + création (modal) + indicateurs.
 * Visibilité PMP / coût : tout user avec ingredient:view (côté API,
 * la permission est exigée). Edit : ingredient:edit (PCA + admin).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Beaker, Plus, Search, AlertTriangle, ChevronRight,
  Package, TrendingDown, X, Filter, CheckCircle, XCircle,
} from 'lucide-react';
import type { Ingredient, IngredientKind } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';

interface Stats {
  totalIngredients: number;
  activeIngredients: number;
  belowMinimum: number;
  totalValue: number;
  rawCount: number;
  semiCount: number;
}

const fmt = (n: number | string | undefined) => {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat('fr-FR').format(Math.round(v));
};

export default function IngredientsPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.INGREDIENT_VIEW}>
      <IngredientsPageContent />
    </ProtectedPage>
  );
}

function IngredientsPageContent() {
  const router = useRouter();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [kindFilter, setKindFilter] = useState<IngredientKind | 'all'>('all');
  const [belowMinOnly, setBelowMinOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [listR, statsR] = await Promise.all([
        fetch('/api/production/ingredients'),
        fetch('/api/production/ingredients/statistics'),
      ]);
      if (listR.ok) setItems((await listR.json()).data || []);
      if (statsR.ok) setStats((await statsR.json()).data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => {
    if (kindFilter !== 'all' && i.Kind !== kindFilter) return false;
    if (belowMinOnly && Number(i.CurrentStock) >= Number(i.MinimumStock)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.Name.toLowerCase().includes(q) && !i.Code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Beaker className="w-7 h-7" /> Matières premières
            </h1>
            <Can permission={PERMISSIONS.INGREDIENT_EDIT}>
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-white text-blue-600 hover:bg-blue-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" /> Nouveau
              </Button>
            </Can>
          </div>

          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi icon={<Package className="w-5 h-5" />} label="Total" value={stats.totalIngredients} hint={`${stats.rawCount} brutes · ${stats.semiCount} semi`} />
              <Kpi icon={<CheckCircle className="w-5 h-5" />} label="Actives" value={stats.activeIngredients} hint="en référentiel" />
              <Kpi icon={<AlertTriangle className="w-5 h-5" />} label="Sous mini" value={stats.belowMinimum} hint="à réapprovisionner" warn={stats.belowMinimum > 0} />
              <Kpi icon={<TrendingDown className="w-5 h-5" />} label="Valeur" value={fmt(stats.totalValue)} hint="XOF en stock" />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (nom, code)…"
              className="w-full pl-12 pr-24 h-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 h-9 rounded-lg font-medium flex items-center gap-2 ${
                showFilters || kindFilter !== 'all' || belowMinOnly ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" /> Filtres
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nature</label>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'raw', 'semi'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setKindFilter(k)}
                      className={`px-4 py-2 rounded-lg font-medium ${
                        kindFilter === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {k === 'all' ? 'Toutes' : k === 'raw' ? 'MP brutes' : 'Semi-finis'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={belowMinOnly} onChange={(e) => setBelowMinOnly(e.target.checked)} />
                Sous le seuil minimum uniquement
              </label>
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
            Aucune matière première — créez la première via « Nouveau ».
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ing) => (
              <IngredientRow key={ing.id} ing={ing} onClick={() => router.push(`/production/ingredients/${ing.IngredientId}`)} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateIngredientModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint, warn }: { icon: React.ReactNode; label: string; value: number | string; hint?: string; warn?: boolean }) {
  return (
    <div className={`backdrop-blur-sm rounded-xl p-4 ${warn ? 'bg-red-500/30' : 'bg-white/20'}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-sm opacity-90">{label}</span></div>
      <p className="text-3xl font-bold">{value}</p>
      {hint && <p className="text-xs opacity-80 mt-1">{hint}</p>}
    </div>
  );
}

function IngredientRow({ ing, onClick }: { ing: Ingredient; onClick: () => void }) {
  const cur = Number(ing.CurrentStock);
  const min = Number(ing.MinimumStock);
  const lowStock = cur < min;
  const out = cur <= 0;
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl shadow p-4 flex items-center gap-4 hover:shadow-lg transition-shadow text-left"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 ${
        ing.Kind === 'semi' ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
      }`}>
        <Beaker className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold truncate">{ing.Name}</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{ing.Code}</span>
          {ing.Kind === 'semi' && (
            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">semi-fini</span>
          )}
          {!ing.IsActive && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">inactif</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
          <span className={`font-semibold ${out ? 'text-red-600' : lowStock ? 'text-orange-600' : 'text-green-700'}`}>
            {fmt(cur)} {ing.Unit}
          </span>
          <span className="text-gray-400">min {fmt(min)}</span>
          <span className="text-gray-400">·</span>
          <span>{fmt(ing.UnitCost)} {ing.Currency}/{ing.Unit}</span>
        </div>
      </div>
      {lowStock && <AlertTriangle className={`w-5 h-5 ${out ? 'text-red-500' : 'text-orange-500'}`} />}
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </button>
  );
}

function CreateIngredientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    unit: 'kg',
    unitCost: '',
    currency: 'XOF',
    minimumStock: '',
    kind: 'raw' as IngredientKind,
    supplier: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim() || !form.code.trim() || !form.unit.trim()) {
      setError('Nom, code et unité sont requis.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/production/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          description: form.description.trim() || undefined,
          unit: form.unit.trim(),
          unitCost: Number(form.unitCost) || 0,
          currency: form.currency,
          minimumStock: Number(form.minimumStock) || 0,
          kind: form.kind,
          supplier: form.supplier.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur création');
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Nouvelle matière première</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex gap-2">
              <XCircle className="w-5 h-5 shrink-0" /> {error}
            </div>
          )}
          <Field label="Nom*"><input className="w-full h-11 px-3 border-2 rounded-lg" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Code*"><input className="w-full h-11 px-3 border-2 rounded-lg" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ex: GINGEMBRE" /></Field>
          <Field label="Description"><textarea className="w-full px-3 py-2 border-2 rounded-lg" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unité*"><input className="w-full h-11 px-3 border-2 rounded-lg" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, g, L, pcs" /></Field>
            <Field label="Coût unitaire">
              <input type="number" min="0" step="0.01" className="w-full h-11 px-3 border-2 rounded-lg" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder="0" />
            </Field>
          </div>
          <Field label="Stock minimum">
            <input type="number" min="0" step="0.001" className="w-full h-11 px-3 border-2 rounded-lg" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: e.target.value })} placeholder="0" />
          </Field>
          <Field label="Nature*">
            <div className="flex gap-2">
              <button
                onClick={() => setForm({ ...form, kind: 'raw' })}
                className={`flex-1 h-11 rounded-lg font-medium ${form.kind === 'raw' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >MP brute</button>
              <button
                onClick={() => setForm({ ...form, kind: 'semi' })}
                className={`flex-1 h-11 rounded-lg font-medium ${form.kind === 'semi' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >Semi-fini</button>
            </div>
          </Field>
          <Field label="Fournisseur (texte libre)">
            <input className="w-full h-11 px-3 border-2 rounded-lg" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </Field>
        </div>
        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
          <Button onClick={submit} disabled={busy} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
            {busy ? 'Création…' : 'Créer'}
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
