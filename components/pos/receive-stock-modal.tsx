'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Plus, Trash2, Loader2, Package } from 'lucide-react';

interface Product { Id?: string; id?: string; ProductId?: string; Name: string; Code: string }
interface Warehouse { Id?: string; id?: string; Name?: string; name?: string }
interface Outlet { id: string; Name: string }

interface ReceiveLine { productId: string; quantity: number; unitCost?: number }

export function ReceiveStockModal({ outletId, onClose, onDone }: {
  outletId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [origin, setOrigin] = useState<{ kind: 'none' | 'warehouse' | 'outlet'; id?: string }>({ kind: 'none' });
  const [lines, setLines] = useState<ReceiveLine[]>([{ productId: '', quantity: 1 }]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products?isActive=true').then(r => r.json()),
      fetch('/api/stock/warehouses?isActive=true').then(r => r.json()),
      fetch('/api/outlets?isActive=true').then(r => r.json()),
    ]).then(([p, w, o]) => {
      setProducts(p.data || []);
      setWarehouses(w.data || []);
      setOutlets((o.data || []).filter((out: Outlet) => out.id !== outletId));
    });
  }, [outletId]);

  function updateLine(i: number, patch: Partial<ReceiveLine>) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function removeLine(i: number) { setLines(ls => ls.filter((_, idx) => idx !== i)); }
  function addLine() { setLines(ls => [...ls, { productId: '', quantity: 1 }]); }

  async function submit() {
    if (lines.some(l => !l.productId || !l.quantity || l.quantity <= 0)) {
      setFeedback('Toutes les lignes doivent avoir un produit et une quantité positive.');
      return;
    }
    setSubmitting(true); setFeedback(null);
    try {
      const body: any = { outletId, lines, notes: 'Réception sur stand' };
      if (origin.kind === 'warehouse') body.fromWarehouseId = origin.id;
      if (origin.kind === 'outlet')    body.fromOutletId    = origin.id;
      const r = await fetch('/api/stock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok && r.status !== 207) throw new Error(result.error || 'Erreur');
      const errs = result?.data?.errors || [];
      if (errs.length > 0) {
        setFeedback(`⚠️ ${result.data.received} OK, ${errs.length} en erreur :\n` +
          errs.map((e: any) => `• ${e.productId} : ${e.message}`).join('\n'));
      } else {
        onDone();
      }
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" /> Réception de stock
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Ajoutez de la marchandise reçue à votre stock outlet. Origine optionnelle (entrepôt ou autre outlet).
        </p>

        {/* Origine */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <label className="text-xs font-semibold text-gray-600 mb-2 block">Origine de la marchandise</label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setOrigin({ kind: 'none' })}
              className={`flex-1 px-3 py-1.5 rounded text-sm border ${origin.kind === 'none' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}>
              Aucune (ad-hoc)
            </button>
            <button onClick={() => setOrigin({ kind: 'warehouse' })}
              className={`flex-1 px-3 py-1.5 rounded text-sm border ${origin.kind === 'warehouse' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}>
              Entrepôt
            </button>
            <button onClick={() => setOrigin({ kind: 'outlet' })}
              className={`flex-1 px-3 py-1.5 rounded text-sm border ${origin.kind === 'outlet' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}>
              Autre outlet
            </button>
          </div>
          {origin.kind === 'warehouse' && (
            <select value={origin.id || ''} onChange={e => setOrigin({ kind: 'warehouse', id: e.target.value })}
              className="w-full px-2 py-1.5 border rounded text-sm">
              <option value="">— Sélectionner un entrepôt —</option>
              {warehouses.map(w => <option key={w.Id || w.id} value={w.Id || w.id}>{w.Name || w.name}</option>)}
            </select>
          )}
          {origin.kind === 'outlet' && (
            <select value={origin.id || ''} onChange={e => setOrigin({ kind: 'outlet', id: e.target.value })}
              className="w-full px-2 py-1.5 border rounded text-sm">
              <option value="">— Sélectionner un outlet —</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.Name}</option>)}
            </select>
          )}
        </div>

        {/* Lignes */}
        <div className="space-y-2 mb-4">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={line.productId} onChange={e => updateLine(i, { productId: e.target.value })}
                className="flex-1 px-2 py-1.5 border rounded text-sm">
                <option value="">— Produit —</option>
                {products.map(p => {
                  // L'API products passe par postgres-client.list → PascalCase (Id majuscule)
                  const pid = p.Id || p.id || p.ProductId || '';
                  return <option key={pid} value={pid}>{p.Name}</option>;
                })}
              </select>
              <input type="number" min={1} step={1} value={line.quantity}
                onChange={e => updateLine(i, { quantity: parseInt(e.target.value, 10) || 0 })}
                className="w-24 px-2 py-1.5 border rounded text-sm text-right" placeholder="Qté" />
              <button onClick={() => removeLine(i)}
                className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={addLine} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Ajouter un produit
          </button>
        </div>

        {feedback && (
          <div className={`mb-3 px-3 py-2 rounded text-sm whitespace-pre-line ${
            feedback.startsWith('✅') ? 'bg-green-50 text-green-800' :
            feedback.startsWith('⚠️') ? 'bg-amber-50 text-amber-800' :
            'bg-red-50 text-red-800'
          }`}>{feedback}</div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Réception…</> : 'Confirmer la réception'}
          </Button>
        </div>
      </div>
    </div>
  );
}
