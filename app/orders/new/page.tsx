'use client';

/**
 * Nouvelle commande client négociée.
 * Saisi par le manager commercial — passe en statut 'draft' jusqu'à l'approbation admin.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';

interface Product { Id?: string; id?: string; Name: string; Code: string; UnitPrice: number }
interface Warehouse { Id?: string; id?: string; Name?: string; name?: string }
interface Wallet { id?: string; Id?: string; Name?: string; name?: string; Type?: string; type?: string }

export default function NewOrderPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<Array<{ productId: string; quantity: number; unitPrice: number; notes?: string }>>([
    { productId: '', quantity: 1, unitPrice: 0 },
  ]);

  // Avance
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceMethod, setAdvanceMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
  const [advanceWalletId, setAdvanceWalletId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products?isActive=true').then(r => r.json()),
      fetch('/api/stock/warehouses?isActive=true').then(r => r.json()),
      fetch('/api/treasury/wallets?isActive=true').then(r => r.json()),
    ]).then(([p, w, wa]) => {
      setProducts(p.data || []); setWarehouses(w.data || []); setWallets(wa.data || []);
    });
  }, []);

  const totalLines = lines.reduce((s, l) => s + (Number(l.quantity) * Number(l.unitPrice)), 0);
  const balance = totalLines - Number(advanceAmount || 0);

  const requiredWalletType = advanceMethod === 'cash' ? 'cash' : advanceMethod === 'mobile_money' ? 'mobile_money' : 'bank';
  const filteredWallets = wallets.filter(w => (w.Type || w.type) === requiredWalletType);

  function updateLine(i: number, patch: Partial<typeof lines[number]>) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLine() { setLines(ls => [...ls, { productId: '', quantity: 1, unitPrice: 0 }]); }
  function removeLine(i: number) { setLines(ls => ls.filter((_, idx) => idx !== i)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientName.trim() && !clientPhone.trim()) { setError('Nom ou téléphone client requis'); return; }
    if (lines.some(l => !l.productId || l.quantity <= 0 || l.unitPrice < 0)) {
      setError('Chaque ligne doit avoir un produit, une quantité et un prix valides'); return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        clientName: clientName.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        totalAmount: totalLines,
        notes: notes || undefined,
        requestedDeliveryDate: requestedDeliveryDate || undefined,
        destinationWarehouseId: destWarehouseId || undefined,
        lines: lines.map(l => ({
          productId: l.productId, quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice), notes: l.notes,
        })),
      };
      if (advanceAmount > 0) {
        body.initialAdvance = {
          amount: Number(advanceAmount),
          paymentMethod: advanceMethod,
          walletId: advanceWalletId || undefined,
        };
      }
      const r = await fetch('/api/customer-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
      router.push(`/orders/${result.data.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally { setSubmitting(false); }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_CREATE}>
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Link href="/orders" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour aux commandes
        </Link>

        <h1 className="text-3xl font-bold">Nouvelle commande client négociée</h1>
        <p className="text-sm text-gray-600">
          La commande passera en statut <strong>brouillon</strong> et devra être approuvée par l'administrateur avant production.
        </p>

        <form onSubmit={submit} className="space-y-4">
          {/* Client */}
          <Section title="Client">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom"      value={clientName}  onChange={setClientName}  placeholder="Nom du client" />
              <Field label="Téléphone" value={clientPhone} onChange={setClientPhone} placeholder="Téléphone" />
            </div>
          </Section>

          {/* Produits */}
          <Section title="Produits & prix négociés">
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select value={l.productId} onChange={e => {
                    const p = products.find(x => (x.Id || x.id) === e.target.value);
                    updateLine(i, { productId: e.target.value, unitPrice: p?.UnitPrice || 0 });
                  }} className="col-span-5 px-2 py-1.5 border rounded text-sm">
                    <option value="">— Produit —</option>
                    {products.map(p => {
                      const id = p.Id || p.id;
                      return <option key={id} value={id}>{p.Name} (réf. {Number(p.UnitPrice).toLocaleString('fr-FR')} XOF)</option>;
                    })}
                  </select>
                  <input type="number" min={0.001} step={0.001} value={l.quantity}
                    onChange={e => updateLine(i, { quantity: Number(e.target.value) })}
                    className="col-span-2 px-2 py-1.5 border rounded text-sm text-right" placeholder="Qté" />
                  <input type="number" min={0} value={l.unitPrice}
                    onChange={e => updateLine(i, { unitPrice: Number(e.target.value) })}
                    className="col-span-3 px-2 py-1.5 border rounded text-sm text-right" placeholder="Prix nego" />
                  <div className="col-span-1 text-right text-xs text-gray-600">
                    {(l.quantity * l.unitPrice).toLocaleString('fr-FR')}
                  </div>
                  <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Ajouter une ligne
              </button>
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between font-bold">
              <span>Total négocié</span>
              <span className="text-xl">{totalLines.toLocaleString('fr-FR')} XOF</span>
            </div>
          </Section>

          {/* Logistique */}
          <Section title="Logistique">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Date livraison souhaitée</label>
                <input type="date" value={requestedDeliveryDate} onChange={e => setRequestedDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Entrepôt destination (Abidjan…)</label>
                <select value={destWarehouseId} onChange={e => setDestWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 border rounded">
                  <option value="">— Aucun —</option>
                  {warehouses.map(w => <option key={w.Id || w.id} value={w.Id || w.id}>{w.Name || w.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600 block mb-1">Notes / conditions négociées</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border rounded" />
              </div>
            </div>
          </Section>

          {/* Avance */}
          <Section title="Avance versée à la création (optionnel)">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Montant avance (XOF)</label>
                <input type="number" min={0} max={totalLines} value={advanceAmount}
                  onChange={e => setAdvanceAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded text-right text-lg font-bold" />
              </div>
              {advanceAmount > 0 && (
                <>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Mode de paiement</label>
                    <select value={advanceMethod} onChange={e => setAdvanceMethod(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded">
                      <option value="cash">Espèces</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="card">TPE / Carte</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-600 block mb-1">Wallet d'encaissement</label>
                    <select value={advanceWalletId} onChange={e => setAdvanceWalletId(e.target.value)}
                      className="w-full px-3 py-2 border rounded">
                      <option value="">— Sélectionner —</option>
                      {filteredWallets.map(w => <option key={w.Id || w.id} value={w.Id || w.id}>{w.Name || w.name}</option>)}
                    </select>
                    {filteredWallets.length === 0 && (
                      <p className="text-xs text-amber-700 mt-1">Aucun wallet de type {requiredWalletType}. <a href="/treasury/wallets/new" className="underline">En créer</a>.</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-sm">
              <span>Solde restant après avance</span>
              <span className="font-bold text-orange-700">{balance.toLocaleString('fr-FR')} XOF</span>
            </div>
          </Section>

          {error && <div className="px-3 py-2 bg-red-50 text-red-800 rounded text-sm">{error}</div>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => router.push('/orders')}>Annuler</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Enregistrement…</> : 'Créer la commande'}
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

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-600 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border rounded" />
    </div>
  );
}
