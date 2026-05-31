'use client';

/**
 * Modal — Journal de caisse du jour pour l'outlet courant.
 *
 * Liste les ventes du jour sur cet outlet, avec totaux : CA brut, encaissé,
 * reste dû. Pratique pour un vendeur qui veut vérifier ses opérations sans
 * quitter le POS.
 *
 * Pas d'endpoint dédié : on filtre /api/sales par date du jour et par outlet
 * en local. Suffisant tant que le volume reste raisonnable (qq dizaines /jour).
 */

import { useEffect, useState } from 'react';
import { Loader2, X, ClipboardList, RefreshCw, FileDown, Share2 } from 'lucide-react';
import {
  shareStandJournalPdf,
  downloadStandJournalPdf,
} from '@/lib/pdf/stand-journal-pdf';

interface Sale {
  id: string;
  SaleNumber: string;
  SaleDate: string;
  TotalAmount: number;
  AmountPaid: number;
  Balance: number;
  Status: string;
  PaymentStatus: string;
  OutletId?: string;
  ClientName?: string;
  CreatedAt?: string;
}

interface SessionJournalModalProps {
  outletId: string;
  outletName?: string;
  onClose: () => void;
}

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));

const todayIso = () => new Date().toISOString().slice(0, 10);

export function SessionJournalModal({ outletId, outletName, onClose }: SessionJournalModalProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const today = todayIso();
      const r = await fetch(`/api/sales?dateFrom=${today}&dateTo=${today}`);
      if (!r.ok) throw new Error('Impossible de charger les ventes');
      const { data } = await r.json();
      const filtered: Sale[] = (data || []).filter((s: Sale) => s.OutletId === outletId);
      setSales(filtered);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Poll tant que la modale est ouverte : ramène les ventes encaissées
    // pendant la consultation (par un autre vendeur sur le même stand, ou
    // par soi-même après checkout).
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [outletId]);

  const totals = sales.reduce(
    (acc, s) => {
      const total = Number(s.TotalAmount || 0);
      const paid = Number(s.AmountPaid || 0);
      const balance = Number(s.Balance || 0);
      acc.count++;
      acc.gross += total;
      acc.paid += paid;
      acc.credit += balance;
      return acc;
    },
    { count: 0, gross: 0, paid: 0, credit: 0 }
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-lg font-bold">Journal de caisse — aujourd'hui</h2>
              {outletName && <p className="text-xs text-gray-500">{outletName}</p>}
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

        {/* Boutons PDF : récupère l'agrégat journalier complet et génère
            le journal à transmettre par WhatsApp (équivalent papier). */}
        <div className="px-5 py-2 border-b bg-amber-50 flex items-center gap-2">
          <p className="text-xs text-amber-800 flex-1">Journal complet du jour pour la direction :</p>
          <button
            onClick={async () => {
              const r = await fetch(`/api/outlets/${encodeURIComponent(outletId)}/daily-report?date=${new Date().toISOString().slice(0,10)}`);
              if (!r.ok) { alert('Erreur chargement journal'); return; }
              const { data } = await r.json();
              await shareStandJournalPdf({
                outletName: data.outlet.name,
                outletCode: data.outlet.code,
                date: data.date,
                sessions: data.sessions,
                byProduct: data.byProduct,
                bySeller: data.bySeller,
                deposits: data.deposits,
                totals: data.totals,
              });
            }}
            className="px-2.5 py-1.5 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700 inline-flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> Partager
          </button>
          <button
            onClick={async () => {
              const r = await fetch(`/api/outlets/${encodeURIComponent(outletId)}/daily-report?date=${new Date().toISOString().slice(0,10)}`);
              if (!r.ok) { alert('Erreur'); return; }
              const { data } = await r.json();
              downloadStandJournalPdf({
                outletName: data.outlet.name,
                outletCode: data.outlet.code,
                date: data.date,
                sessions: data.sessions,
                byProduct: data.byProduct,
                bySeller: data.bySeller,
                deposits: data.deposits,
                totals: data.totals,
              });
            }}
            className="px-2.5 py-1.5 rounded-md border border-amber-300 bg-white text-amber-800 text-xs font-semibold hover:bg-amber-100 inline-flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
        </div>

        {/* Totaux */}
        <div className="grid grid-cols-4 gap-2 px-5 py-3 bg-gray-50 border-b text-center">
          <div>
            <p className="text-[11px] uppercase font-semibold text-gray-500">Ventes</p>
            <p className="text-xl font-bold">{totals.count}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-gray-500">CA brut</p>
            <p className="text-xl font-bold">{fmt(totals.gross)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-emerald-700">Encaissé</p>
            <p className="text-xl font-bold text-emerald-700">{fmt(totals.paid)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase font-semibold text-amber-700">À recouvrer</p>
            <p className="text-xl font-bold text-amber-700">{fmt(totals.credit)}</p>
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-auto px-2 py-2">
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-6 h-6 mx-auto animate-spin text-emerald-600" /></div>
          ) : error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg mx-3 my-2 px-3 py-2">{error}</div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              Aucune vente sur ce stand aujourd'hui.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr className="border-b">
                  <th className="text-left px-3 py-2">N°</th>
                  <th className="text-left px-3 py-2">Client</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Encaissé</th>
                  <th className="text-right px-3 py-2">Reste</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{s.SaleNumber}</td>
                    <td className="px-3 py-2 truncate max-w-[180px]">{s.ClientName || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(s.TotalAmount)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{fmt(s.AmountPaid)}</td>
                    <td className="px-3 py-2 text-right">
                      {Number(s.Balance) > 0
                        ? <span className="text-amber-700 font-semibold">{fmt(s.Balance)}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
