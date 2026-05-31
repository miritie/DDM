'use client';

/**
 * Modal — Envoyer du stock du stand courant vers un autre stand.
 *
 * Le vendeur sélectionne un autre outlet destination + une ou plusieurs
 * lignes (produit + qté). À la confirmation, POST /api/stock/transfers
 * avec source = outlet courant, destination = outlet cible (par ligne).
 *
 * Le service back gère déjà :
 *   - décrément stock source
 *   - création stock_transfers + lines en pending
 *   - le stand destination verra le mouvement dans sa modal Réceptions
 */

import { useEffect, useState } from 'react';
import { Loader2, X, ArrowRightLeft, Plus, Trash2, Send } from 'lucide-react';

interface SendStockModalProps {
  outletId: string;
  outletName: string;
  outletCode: string;
  onClose: () => void;
  onSent: () => void;
}

interface OutletOption { id: string; Code?: string; code?: string; Name?: string; name?: string }
interface StockItem { product: { id: string; name: string; code: string }; quantity: number; minimumStock: number }
interface LineDraft { productId: string; qty: string; max: number }

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

export function SendStockModal({ outletId, outletName, outletCode, onClose, onSent }: SendStockModalProps) {
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [destCode, setDestCode] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ productId: '', qty: '', max: 0 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [outletId]);

  async function load() {
    setLoading(true);
    try {
      const [outRes, stRes] = await Promise.allSettled([
        fetch('/api/outlets?isActive=true'),
        fetch(`/api/stock/locations/outlet/${encodeURIComponent(outletId)}/summary`),
      ]);
      if (outRes.status === 'fulfilled' && outRes.value.ok) {
        const { data } = await outRes.value.json();
        // Exclut le stand courant lui-même de la liste destination
        setOutlets((data ?? []).filter((o: any) => (o.Code ?? o.code) !== outletCode));
      }
      if (stRes.status === 'fulfilled' && stRes.value.ok) {
        const { data } = await stRes.value.json();
        setStock(data?.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setLines([...lines, { productId: '', qty: '', max: 0 }]);
  }
  function removeLine(i: number) {
    setLines(lines.length === 1 ? [{ productId: '', qty: '', max: 0 }] : lines.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, patch: Partial<LineDraft>) {
    setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function selectProduct(i: number, productId: string) {
    const item = stock.find(s => s.product.id === productId);
    updateLine(i, { productId, qty: '', max: item ? item.quantity : 0 });
  }

  async function submit() {
    setError(null);
    if (!destCode) { setError('Choisissez un stand destination.'); return; }
    const validLines = lines.filter(l => l.productId && Number(l.qty) > 0);
    if (validLines.length === 0) { setError('Ajoutez au moins une ligne avec produit + quantité.'); return; }
    for (const l of validLines) {
      const qty = Number(l.qty);
      if (qty > l.max) {
        const productName = stock.find(s => s.product.id === l.productId)?.product.name ?? l.productId;
        setError(`Quantité ${qty} > stock disponible (${l.max}) pour ${productName}`);
        return;
      }
    }

    setBusy(true);
    try {
      const r = await fetch('/api/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { outletId: outletCode },
          lines: validLines.map(l => ({
            productId: l.productId,
            qtySent: Number(l.qty),
            destination: { outletId: destCode },
          })),
          notes: `Envoyé depuis ${outletName} (POS)`,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Erreur création transfert');
      }
      onSent();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold">Envoyer du stock</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          <div className="text-xs text-gray-600 bg-gray-50 border rounded-lg px-3 py-2">
            Depuis <strong>{outletName}</strong> → choisis un stand destination. Le mouvement passera en attente côté destination jusqu'à confirmation par le vendeur sur place.
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Stand destination</label>
            {loading ? (
              <div className="text-center py-3"><Loader2 className="w-4 h-4 mx-auto animate-spin text-purple-600" /></div>
            ) : (
              <select
                value={destCode}
                onChange={(e) => setDestCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">— Choisir un stand —</option>
                {outlets.map(o => {
                  const code = o.Code ?? o.code ?? '';
                  const name = o.Name ?? o.name ?? '?';
                  return <option key={code} value={code}>{name}</option>;
                })}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Produits à envoyer</label>
            {stock.length === 0 && !loading && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                Aucun stock disponible sur ce stand.
              </p>
            )}
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded border bg-gray-50">
                  <select
                    value={l.productId}
                    onChange={(e) => selectProduct(i, e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 border rounded text-sm"
                  >
                    <option value="">— Produit —</option>
                    {stock.map(s => (
                      <option key={s.product.id} value={s.product.id}>
                        {s.product.name} (dispo : {fmt(s.quantity)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number" inputMode="numeric" min={1} step={1} max={l.max}
                    value={l.qty}
                    onChange={(e) => updateLine(i, { qty: e.target.value })}
                    placeholder="Qté"
                    disabled={!l.productId}
                    className="w-20 px-2 py-1.5 border rounded text-sm text-right disabled:opacity-50"
                  />
                  <button
                    onClick={() => removeLine(i)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    aria-label="Retirer ligne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addLine}
                className="w-full px-3 py-2 rounded border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:bg-gray-50 inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Ajouter une ligne
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="border-t p-3 flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 py-2.5 rounded-md bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
