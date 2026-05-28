'use client';

/**
 * Modal — Transferts entrants à confirmer sur le stand courant.
 *
 * Liste les lignes en statut `pending` dont la destination est l'outlet
 * actif. Le vendeur peut :
 *   - Confirmer une ligne en intégralité (qty reçue = qty envoyée)
 *   - Confirmer en quantité partielle (qty < qty envoyée) — le service
 *     bascule alors la ligne en `adjusted` + `shortfall_decision='pending'`.
 *
 * La quantité reçue est saisissable et capée côté UI à `qty_sent` (la
 * route confirmLeg refuse > qty_sent). La saisie « 0 » désactive le
 * bouton — pour un refus pur, ce sera un autre endpoint (non implémenté
 * ici, voir /lines/{id}/refuse côté service).
 *
 * Utilise les endpoints existants :
 *   GET  /api/stock/transfers/incoming
 *   POST /api/stock/transfers/lines/{lineId}/confirm
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X, Truck, RefreshCw, Check, AlertTriangle } from 'lucide-react';

interface IncomingLine {
  id: string;
  product_id: string;
  product_name: string;
  qty_sent: number;
  qty_received: number;
  unit: string;
  leg_status: string;
  destination_warehouse_id: string | null;
  destination_outlet_id: string | null;
  destination_outlet_name?: string | null;
  destination_warehouse_name?: string | null;
}

interface IncomingTransfer {
  id: string;
  transfer_id: string;
  transfer_number: string;
  source_warehouse_id: string | null;
  source_warehouse_name?: string | null;
  source_outlet_id: string | null;
  source_outlet_name?: string | null;
  created_at: string;
  lines: IncomingLine[];
}

interface IncomingTransfersModalProps {
  outletId: string;
  onClose: () => void;
  onConfirmed?: () => void;
}

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));

export function IncomingTransfersModal({ outletId, onClose, onConfirmed }: IncomingTransfersModalProps) {
  const [transfers, setTransfers] = useState<IncomingTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingLineId, setConfirmingLineId] = useState<string | null>(null);

  // Quantité saisie par ligne (string pour permettre input vide en cours
  // de frappe). Initialisée à qty_sent au chargement.
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/stock/transfers/incoming');
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Impossible de charger les transferts');
      }
      const { data } = await r.json();
      const filtered = (data || []).filter((t: IncomingTransfer) =>
        (t.lines || []).some(
          (l) => l.leg_status === 'pending' && l.destination_outlet_id === outletId
        )
      );
      setTransfers(filtered);

      // Pré-remplit les inputs : qty_sent par défaut, sans écraser une
      // valeur déjà saisie par le vendeur (sinon le poll ferait sauter
      // la saisie en cours).
      setQtyByLine((prev) => {
        const next = { ...prev };
        for (const t of filtered) {
          for (const l of t.lines) {
            if (l.leg_status === 'pending' && l.destination_outlet_id === outletId && next[l.id] === undefined) {
              next[l.id] = String(Math.round(Number(l.qty_sent)));
            }
          }
        }
        return next;
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { void load(); }, [load]);

  async function confirmLine(line: IncomingLine) {
    const raw = qtyByLine[line.id];
    const qtyReceived = parseInt(raw ?? '', 10);
    if (!Number.isFinite(qtyReceived) || qtyReceived <= 0) {
      setError(`Saisis une quantité positive pour ${line.product_name}.`);
      return;
    }
    if (qtyReceived > Number(line.qty_sent)) {
      setError(`La quantité reçue (${qtyReceived}) ne peut dépasser la quantité envoyée (${fmt(line.qty_sent)}).`);
      return;
    }
    setConfirmingLineId(line.id);
    setError(null);
    try {
      const r = await fetch(`/api/stock/transfers/lines/${line.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtyReceived }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Erreur confirmation');
      }
      // Retire la valeur saisie pour éviter qu'elle ne resurgisse au
      // prochain poll si la ligne réapparaissait (cas rare).
      setQtyByLine((prev) => {
        const next = { ...prev };
        delete next[line.id];
        return next;
      });
      await load();
      onConfirmed?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConfirmingLineId(null);
    }
  }

  const pendingCount = transfers.reduce(
    (s, t) => s + t.lines.filter((l) => l.leg_status === 'pending' && l.destination_outlet_id === outletId).length,
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-lg font-bold">Réceptions à confirmer</h2>
              <p className="text-xs text-gray-500">{pendingCount} ligne{pendingCount > 1 ? 's' : ''} en attente</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={load} disabled={loading} className="p-2 rounded-md hover:bg-gray-100" aria-label="Rafraîchir">
              <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100" aria-label="Fermer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-3">
          {error && (
            <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {loading && transfers.length === 0 ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 mx-auto animate-spin text-purple-600" /></div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              Aucune réception en attente sur ce stand.
            </div>
          ) : (
            <div className="space-y-4">
              {transfers.map((t) => (
                <div key={t.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono font-semibold">{t.transfer_number}</span>
                      <span className="text-gray-500 ml-2">
                        depuis {t.source_warehouse_name || t.source_outlet_name || '—'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="divide-y">
                    {t.lines
                      .filter((l) => l.leg_status === 'pending' && l.destination_outlet_id === outletId)
                      .map((l) => {
                        const raw = qtyByLine[l.id] ?? '';
                        const parsed = parseInt(raw, 10);
                        const isPartial = Number.isFinite(parsed) && parsed > 0 && parsed < Number(l.qty_sent);
                        return (
                          <div key={l.id} className="flex items-center gap-3 px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{l.product_name}</p>
                              <p className="text-xs text-gray-500">
                                envoyé : <strong>{fmt(l.qty_sent)}</strong> {l.unit}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={Number(l.qty_sent)}
                                step={1}
                                value={raw}
                                onChange={(e) => setQtyByLine((prev) => ({ ...prev, [l.id]: e.target.value }))}
                                className={`w-20 px-2 py-1.5 border rounded text-sm text-right ${
                                  isPartial ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                                }`}
                                aria-label={`Quantité reçue pour ${l.product_name}`}
                              />
                              <span className="text-xs text-gray-500 w-10">{l.unit}</span>
                              <button
                                onClick={() => confirmLine(l)}
                                disabled={confirmingLineId === l.id}
                                className={`px-3 py-1.5 rounded-md text-white text-sm disabled:opacity-50 inline-flex items-center gap-1.5 ${
                                  isPartial ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                                title={isPartial ? 'Confirmation partielle — la ligne passera en ajustement' : 'Confirmation intégrale'}
                              >
                                {confirmingLineId === l.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Check className="w-3.5 h-3.5" />}
                                {isPartial ? 'Partiel' : 'Confirmer'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-100">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
