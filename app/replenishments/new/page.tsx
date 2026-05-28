'use client';

/**
 * Création d'un approvisionnement stand.
 * - 1+ produits avec quantité demandée
 * - pour chaque produit : ventilation sur 1+ stands cibles (somme = qty demandée)
 * - valorisation auto au prix de vente (products.unit_price)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Trash2, Loader2, Truck } from 'lucide-react';

interface Product { id: string; name: string; code: string; unitPrice: number }
interface Outlet { id: string; code: string; name: string }

interface LineForm {
  productId: string;
  quantityRequested: number;
  unitCost: number;
  targets: Array<{ outletId: string; quantityTarget: number }>;
}

export default function NewReplenishmentPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [lines, setLines] = useState<LineForm[]>([
    { productId: '', quantityRequested: 0, unitCost: 0, targets: [{ outletId: '', quantityTarget: 0 }] },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products/with-cost').then(r => r.json()),
      fetch('/api/stock/outlets').then(r => r.json()),
    ]).then(([p, o]) => {
      setProducts((p.data || []).map((x: any) => ({
        id: x.id, name: x.name, code: x.code, unitPrice: Number(x.unitPrice || 0),
      })));
      setOutlets((o.data || []).filter((x: any) => x.isActive).map((x: any) => ({
        id: x.id, code: x.slug, name: x.name,
      })));
    });
  }, []);

  function updateLine(i: number, patch: Partial<LineForm>) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function updateTarget(i: number, ti: number, patch: Partial<LineForm['targets'][number]>) {
    setLines(ls => ls.map((l, idx) => idx !== i ? l : {
      ...l,
      targets: l.targets.map((t, ti2) => ti2 === ti ? { ...t, ...patch } : t),
    }));
  }
  function addLine() {
    setLines(ls => [...ls, { productId: '', quantityRequested: 0, unitCost: 0, targets: [{ outletId: '', quantityTarget: 0 }] }]);
  }
  function removeLine(i: number) {
    setLines(ls => ls.filter((_, idx) => idx !== i));
  }
  function addTarget(i: number) {
    setLines(ls => ls.map((l, idx) => idx !== i ? l : { ...l, targets: [...l.targets, { outletId: '', quantityTarget: 0 }] }));
  }
  function removeTarget(i: number, ti: number) {
    setLines(ls => ls.map((l, idx) => idx !== i ? l : { ...l, targets: l.targets.filter((_, ti2) => ti2 !== ti) }));
  }

  function onProductChange(i: number, productId: string) {
    const p = products.find(x => x.id === productId);
    updateLine(i, { productId, unitCost: p?.unitPrice || 0 });
  }

  function lineTotal(l: LineForm): number {
    return l.quantityRequested * l.unitCost;
  }
  function targetsSum(l: LineForm): number {
    return l.targets.reduce((s, t) => s + (Number(t.quantityTarget) || 0), 0);
  }
  function lineHasError(l: LineForm): string | null {
    if (!l.productId) return 'Choisir un produit';
    if (l.quantityRequested <= 0) return 'Quantité demandée invalide';
    if (l.targets.length === 0) return 'Ajouter au moins un stand cible';
    if (l.targets.some(t => !t.outletId || t.quantityTarget <= 0)) return 'Compléter chaque cible (stand + quantité)';
    if (Math.abs(targetsSum(l) - l.quantityRequested) > 0.001) {
      return `Somme cibles (${targetsSum(l)}) ≠ qté demandée (${l.quantityRequested})`;
    }
    return null;
  }

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const allLineErrors = lines.map(lineHasError).filter(Boolean) as string[];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (allLineErrors.length > 0) {
      setError(`Corrige avant d'envoyer : ${allLineErrors.join(' · ')}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch('/api/replenishments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes || undefined,
          requestedDeliveryDate: deliveryDate || undefined,
          lines: lines.map(l => ({
            productId: l.productId,
            quantityRequested: l.quantityRequested,
            unitCost: l.unitCost,
            targets: l.targets.map(t => ({ outletId: t.outletId, quantityTarget: t.quantityTarget })),
          })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      router.push(`/replenishments/${j.data.id}`);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.REPLENISHMENT_CREATE}>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Link href="/replenishments" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour
        </Link>

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Truck className="w-7 h-7 text-violet-600" /> Nouvelle demande d'approvisionnement stand
        </h1>
        <p className="text-sm text-gray-600">
          Pas de paiement : il s'agit d'une commande interne. Après validation admin,
          tu pourras lier une production (si stock insuffisant) puis distribuer aux stands.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <Section title="Informations générales">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Date livraison souhaitée</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded" placeholder="Contexte, urgence, etc." />
              </div>
            </div>
          </Section>

          <Section title="Produits demandés & ventilation par stand">
            <div className="space-y-4">
              {lines.map((l, i) => (
                <div key={i} className="border rounded-xl p-4 bg-gray-50 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2">
                      <div className="md:col-span-5">
                        <label className="text-xs text-gray-600 block mb-1">Produit</label>
                        <select value={l.productId} onChange={(e) => onProductChange(i, e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm">
                          <option value="">— Sélectionner —</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-xs text-gray-600 block mb-1">Qté totale demandée</label>
                        <input type="number" min={1} step={1} value={l.quantityRequested}
                          onChange={(e) => updateLine(i, { quantityRequested: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-2 py-1.5 border rounded text-sm text-right" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-xs text-gray-600 block mb-1">
                          Prix unitaire
                          <span className="ml-1 text-[10px] text-gray-400">(auto · prix de vente)</span>
                        </label>
                        <input type="number" value={l.unitCost} readOnly disabled
                          className="w-full px-2 py-1.5 border rounded text-sm text-right bg-gray-100 cursor-not-allowed" />
                      </div>
                      <div className="md:col-span-1 flex items-end justify-end">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Targets */}
                  <div className="pl-3 border-l-2 border-violet-300">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">Ventilation par stand</span>
                      <span className={`text-xs ${Math.abs(targetsSum(l) - l.quantityRequested) > 0.001 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                        Somme : {targetsSum(l)} / {l.quantityRequested}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {l.targets.map((t, ti) => (
                        <div key={ti} className="grid grid-cols-12 gap-2 items-center">
                          <select value={t.outletId} onChange={(e) => updateTarget(i, ti, { outletId: e.target.value })}
                            className="col-span-8 px-2 py-1 border rounded text-sm">
                            <option value="">— Stand —</option>
                            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                          <input type="number" min={1} step={1} value={t.quantityTarget}
                            onChange={(e) => updateTarget(i, ti, { quantityTarget: parseInt(e.target.value, 10) || 0 })}
                            className="col-span-3 px-2 py-1 border rounded text-sm text-right" placeholder="Qté" />
                          <button type="button" onClick={() => removeTarget(i, ti)}
                            disabled={l.targets.length === 1}
                            className="col-span-1 text-gray-400 hover:text-red-600 disabled:opacity-30">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addTarget(i)}
                        className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Ajouter un stand
                      </button>
                    </div>
                  </div>

                  {/* Sous-total ligne */}
                  <div className="text-right text-sm text-gray-700">
                    Sous-total : <strong>{Math.round(lineTotal(l)).toLocaleString('fr-FR')} XOF</strong>
                  </div>

                  {lineHasError(l) && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                      ⚠️ {lineHasError(l)}
                    </div>
                  )}
                </div>
              ))}
              <button type="button" onClick={addLine}
                className="text-sm text-violet-600 hover:underline inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Ajouter un produit
              </button>
            </div>

            <div className="mt-4 pt-3 border-t flex justify-between font-bold">
              <span>Valeur totale (estimation)</span>
              <span className="text-xl">{Math.round(grandTotal).toLocaleString('fr-FR')} XOF</span>
            </div>
          </Section>

          {error && (
            <div className="px-3 py-2 bg-red-50 text-red-800 border border-red-200 rounded text-sm">
              ❌ {error}
            </div>
          )}
          {allLineErrors.length > 0 && !error && (
            <div className="px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded text-sm">
              ⚠️ {allLineErrors.length} ligne(s) avec un problème. Corrige avant d'envoyer :
              <ul className="list-disc list-inside mt-1">
                {allLineErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => router.push('/replenishments')}>Annuler</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Enregistrement…</> : 'Créer la demande'}
            </Button>
          </div>
        </form>
      </div>
    </ProtectedPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-2xl border">
      <h2 className="font-bold mb-3">{title}</h2>
      {children}
    </div>
  );
}
