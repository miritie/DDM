'use client';

/**
 * Modal — Fermeture de caisse formelle (Z-out).
 *
 * Le vendeur saisit le cash physiquement compté dans son tiroir.
 * Le modal affiche en parallèle :
 *   - Le cash attendu de la SESSION (= ventes cash − dépôts cash effectués
 *     pendant que la session était active). Calcul faisant autorité côté
 *     serveur via /api/pos/sessions/{id}/cash-summary.
 *   - La discordance calculée live (compté − attendu)
 * Au valider, POST /api/pos/sessions/{id}/close-cash :
 *   - le serveur recalcule expected (zéro confiance dans le client)
 *   - marque la session ended_at + closed_by_id + closing_cash_*
 *   - le wallet balance n'est PAS modifié
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X, Wallet, Check, AlertTriangle } from 'lucide-react';

interface CloseCashModalProps {
  outletId: string;
  outletName: string;
  onClose: () => void;
  onClosed: () => void;
}

interface Session { id: string; StartedAt?: string }

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XOF';

export function CloseCashModal({ outletId, outletName, onClose, onClosed }: CloseCashModalProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<{ id: string; name: string } | null>(null);
  // Cash attendu = ventes cash de la session − dépôts cash. NE PAS confondre
  // avec le solde cumulé du wallet (qui n'est jamais crédité par les ventes
  // dans la V1 et représente l'historique total).
  const [summary, setSummary] = useState<{ cashIn: number; cashOut: number; expected: number } | null>(null);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Récupère la session active
      const sessRes = await fetch('/api/pos/sessions/active?outletId=' + encodeURIComponent(outletId));
      const sess = sessRes.ok ? (await sessRes.json()).data : null;
      setSession(sess ?? null);

      // 2) Cash attendu (cash-summary nécessite l'id de session)
      if (sess?.id) {
        const sumRes = await fetch('/api/pos/sessions/' + sess.id + '/cash-summary');
        if (sumRes.ok) {
          const { data } = await sumRes.json();
          setSummary({ cashIn: data.cashIn, cashOut: data.cashOut, expected: data.expected });
          // Pré-remplit le compté avec l'attendu pour faciliter le cas équilibré
          setCounted(String(Math.max(0, Math.round(Number(data.expected)))));
        }
      }

      // 3) Wallet caisse — pour info (label), pas pour le calcul d'expected
      const balRes = await fetch('/api/outlets/' + encodeURIComponent(outletId) + '/cash-balance');
      if (balRes.ok) {
        const { data } = await balRes.json();
        setWallet(data?.wallet ? { id: data.wallet.id, name: data.wallet.name } : null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { void load(); }, [load]);

  const expected = summary?.expected ?? 0;
  const countedNum = Number(counted) || 0;
  const discrepancy = countedNum - expected;
  const hasDiscrepancy = Math.abs(discrepancy) > 0;

  async function submit() {
    if (!session) { setError('Aucune session active à clôturer.'); return; }
    if (!Number.isFinite(countedNum) || countedNum < 0) {
      setError('Saisis un montant compté valide (≥ 0).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/pos/sessions/' + session.id + '/close-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashCounted: countedNum,
          cashWalletId: wallet?.id ?? null,
          notes: notes.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Erreur clôture');
      }
      onClosed();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="text-base font-bold">Fermeture de caisse</h2>
              <p className="text-xs text-gray-500">{outletName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100" aria-label="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-10"><Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-600" /></div>
          ) : !session ? (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Aucune session POS active à clôturer sur ce stand.
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                <p className="text-[11px] uppercase font-semibold text-amber-700 tracking-wide">Cash attendu en caisse</p>
                <p className="text-3xl font-bold text-amber-900 mt-1">{fmt(expected)}</p>
                {summary && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-amber-800">
                    <div className="flex justify-between bg-white/60 rounded px-2 py-1">
                      <span>Ventes cash</span><span className="font-semibold">+{fmt(summary.cashIn)}</span>
                    </div>
                    <div className="flex justify-between bg-white/60 rounded px-2 py-1">
                      <span>Dépôts</span><span className="font-semibold">−{fmt(summary.cashOut)}</span>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-amber-700 mt-2">
                  Cumul des ventes cash de la session moins les versements de caisse effectués.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Cash physiquement compté</label>
                <input
                  type="number" inputMode="numeric" min={0} step={1}
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-3 border border-gray-300 rounded-md text-right text-2xl font-bold"
                  autoFocus
                />
              </div>

              <div className={
                'rounded-xl px-4 py-3 border-2 ' + (
                  !hasDiscrepancy ? 'bg-emerald-50 border-emerald-300' :
                  discrepancy > 0 ? 'bg-blue-50 border-blue-300' :
                  'bg-red-50 border-red-300'
                )
              }>
                <p className={
                  'text-xs uppercase font-semibold tracking-wide ' + (
                    !hasDiscrepancy ? 'text-emerald-700' :
                    discrepancy > 0 ? 'text-blue-700' :
                    'text-red-700'
                  )
                }>
                  {!hasDiscrepancy
                    ? 'Caisse équilibrée'
                    : discrepancy > 0 ? 'Excédent'
                    : 'Manquant'}
                </p>
                <p className={
                  'text-2xl font-bold mt-0.5 ' + (
                    !hasDiscrepancy ? 'text-emerald-800' :
                    discrepancy > 0 ? 'text-blue-800' :
                    'text-red-800'
                  )
                }>
                  {discrepancy > 0 ? '+' : ''}{fmt(discrepancy)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Observation (optionnel)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={hasDiscrepancy ? 'Explique la discordance si tu peux…' : 'Notes de fin de journée…'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={3}
                />
              </div>

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 inline-flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}
            </>
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
            disabled={busy || loading || !session}
            className="flex-1 py-2.5 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Clôturer la caisse
          </button>
        </div>
      </div>
    </div>
  );
}
