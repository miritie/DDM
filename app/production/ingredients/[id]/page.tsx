'use client';

/**
 * Page - Détail d'une matière première
 *
 * - Affichage : Kind, stock courant, PMP, fournisseur préféré, recettes utilisant cette MP.
 * - Édition (ingredient:edit) : nom, code, description, unité, minimum, kind, supplier.
 * - Réception rapide (purchase_request:receive) : ajouter directement du stock + recalcul PMP.
 */
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Beaker, ArrowLeft, Pencil, Save, X, AlertTriangle, Plus,
  Package, TrendingUp, TrendingDown, Calendar,
} from 'lucide-react';
import type { Ingredient, IngredientKind } from '@/types/modules';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function IngredientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedPage permission={PERMISSIONS.INGREDIENT_VIEW}>
      <Content id={id} />
    </ProtectedPage>
  );
}

function Content({ id }: { id: string }) {
  const router = useRouter();
  const [ing, setIng] = useState<Ingredient | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/production/ingredients/${id}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      setIng(data.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!ing) {
    return <div className="p-8 text-center text-gray-500">Matière première introuvable.</div>;
  }

  const cur = Number(ing.CurrentStock);
  const min = Number(ing.MinimumStock);
  const lowStock = cur < min;
  const out = cur <= 0;
  const value = cur * Number(ing.UnitCost);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className={`text-white p-6 pb-10 ${
        ing.Kind === 'semi' ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gradient-to-r from-blue-600 to-cyan-600'
      }`}>
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Beaker className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{ing.Name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
                  <span className="bg-white/20 px-2 py-0.5 rounded">{ing.Code}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded">{ing.Kind === 'semi' ? 'Semi-fini' : 'MP brute'}</span>
                  {!ing.IsActive && <span className="bg-red-500/40 px-2 py-0.5 rounded">Inactif</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Can permission={PERMISSIONS.PURCHASE_REQUEST_RECEIVE}>
                <Button onClick={() => setShowReceive(true)} className="bg-white/20 hover:bg-white/30 border border-white/40">
                  <Plus className="w-4 h-4 mr-1" /> Réception
                </Button>
              </Can>
              <Can permission={PERMISSIONS.INGREDIENT_EDIT}>
                <Button onClick={() => setEditing(true)} className="bg-white text-blue-600 hover:bg-blue-50">
                  <Pencil className="w-4 h-4 mr-1" /> Modifier
                </Button>
              </Can>
            </div>
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
            <StatCard
              icon={<Package className="w-5 h-5 text-blue-600" />}
              label="Stock courant"
              value={`${fmt(cur)} ${ing.Unit}`}
              warn={out ? 'rupture' : lowStock ? 'stock faible' : undefined}
              tone={out ? 'red' : lowStock ? 'orange' : 'green'}
            />
            <StatCard
              icon={<TrendingDown className="w-5 h-5 text-gray-600" />}
              label="Stock minimum"
              value={`${fmt(min)} ${ing.Unit}`}
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5 text-gray-600" />}
              label="PMP courant"
              value={`${fmt(ing.UnitCost)} ${ing.Currency}/${ing.Unit}`}
              hint="Prix moyen pondéré"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5 text-gray-600" />}
              label="Valeur stock"
              value={`${fmt(value)} ${ing.Currency}`}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold mb-3">Informations</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-gray-500">Description</dt>
            <dd>{ing.Description || '—'}</dd>
            <dt className="text-gray-500">Fournisseur préféré</dt>
            <dd>{ing.Supplier || '—'}</dd>
            <dt className="text-gray-500">Créé le</dt>
            <dd>{fmtDate(ing.CreatedAt)}</dd>
            <dt className="text-gray-500">Modifié le</dt>
            <dd>{fmtDate(ing.UpdatedAt)}</dd>
          </dl>
        </div>
      </div>

      {editing && (
        <EditModal ing={ing} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      )}
      {showReceive && (
        <ReceiveModal ing={ing} onClose={() => setShowReceive(false)} onReceived={() => { setShowReceive(false); load(); }} />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint, warn, tone }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; warn?: string;
  tone?: 'red' | 'orange' | 'green';
}) {
  const toneClass = tone === 'red' ? 'text-red-600' : tone === 'orange' ? 'text-orange-600' : tone === 'green' ? 'text-green-700' : '';
  return (
    <div>
      <div className="flex items-center gap-2 mb-1 text-gray-500 text-sm">{icon} {label}</div>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      {(hint || warn) && <p className={`text-xs mt-1 ${warn ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>{warn || hint}</p>}
    </div>
  );
}

function EditModal({ ing, onClose, onSaved }: { ing: Ingredient; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: ing.Name,
    code: ing.Code,
    description: ing.Description ?? '',
    unit: ing.Unit,
    minimumStock: String(ing.MinimumStock),
    kind: ing.Kind,
    supplier: ing.Supplier ?? '',
    isActive: ing.IsActive,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/production/ingredients/${ing.IngredientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim(),
          description: form.description.trim() || null,
          unit: form.unit.trim(),
          minimumStock: Number(form.minimumStock) || 0,
          kind: form.kind,
          supplier: form.supplier.trim() || null,
          isActive: form.isActive,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Modifier la matière première" onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <Field label="Nom"><input className={INP} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Code"><input className={INP} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
      <Field label="Description"><textarea className={INP_TA} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unité"><input className={INP} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
        <Field label="Minimum">
          <input type="number" min="0" step="0.001" className={INP} value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: e.target.value })} />
        </Field>
      </div>
      <Field label="Nature">
        <div className="flex gap-2">
          {(['raw', 'semi'] as IngredientKind[]).map((k) => (
            <button key={k} onClick={() => setForm({ ...form, kind: k })}
              className={`flex-1 h-11 rounded-lg font-medium ${form.kind === k ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
              {k === 'raw' ? 'MP brute' : 'Semi-fini'}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Fournisseur (texte libre)">
        <input className={INP} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
        <span className="text-sm">Actif</span>
      </label>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
        <Button onClick={save} disabled={busy} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-1" /> {busy ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </Modal>
  );
}

function ReceiveModal({ ing, onClose, onReceived }: { ing: Ingredient; onClose: () => void; onReceived: () => void }) {
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(String(ing.UnitCost));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estimation du nouveau PMP en preview
  const newPmp = (() => {
    const stockBefore = Number(ing.CurrentStock);
    const pmpBefore = Number(ing.UnitCost);
    const q = Number(qty);
    const p = Number(price);
    if (!q || q <= 0) return null;
    if (stockBefore <= 0) return p;
    return (stockBefore * pmpBefore + q * p) / (stockBefore + q);
  })();

  async function submit() {
    if (!qty || Number(qty) <= 0) { setError('Quantité doit être > 0'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/production/ingredients/${ing.IngredientId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'increase',
          quantity: Number(qty),
          unitCost: Number(price),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur réception');
      onReceived();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Réception rapide" onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <p className="text-sm text-gray-500">
        Réception rapide directe (sans sollicitation préalable). Pour un cycle complet
        avec validation budgétaire, utilisez « Sollicitations d'achat MP ».
      </p>
      <Field label={`Quantité reçue (${ing.Unit})`}>
        <input type="number" min="0" step="0.001" className={INP} value={qty} onChange={(e) => setQty(e.target.value)} />
      </Field>
      <Field label={`Prix unitaire (${ing.Currency}/${ing.Unit})`}>
        <input type="number" min="0" step="0.01" className={INP} value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label="Notes (optionnel)">
        <textarea className={INP_TA} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {newPmp !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="text-blue-900">
            <strong>Nouveau PMP estimé :</strong> {fmt(newPmp)} {ing.Currency}/{ing.Unit}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Stock après réception : {fmt(Number(ing.CurrentStock) + Number(qty || 0))} {ing.Unit}
          </p>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
        <Button onClick={submit} disabled={busy} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
          {busy ? 'Réception…' : 'Confirmer'}
        </Button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

const INP = 'w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500';
const INP_TA = 'w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
