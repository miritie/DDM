'use client';

/**
 * Modal — Journal de caisse du jour pour l'outlet courant.
 *
 * Liste les ventes du jour sur cet outlet, avec totaux : CA brut, encaissé,
 * reste dû. Pratique pour un vendeur qui veut vérifier ses opérations sans
 * quitter le POS.
 *
 * Permet aussi de :
 *   - saisir l'observation libre du commercial pour la journée (persistée
 *     côté serveur — apparaît dans le PDF)
 *   - générer/partager le PDF journal complet (équivalent papier DUNE DE MIEL)
 */

import { useEffect, useState } from 'react';
import { Loader2, X, ClipboardList, RefreshCw, FileDown, Share2, MessageSquare, Check, Package } from 'lucide-react';
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

interface ProductStockLine {
  name: string;
  code: string;
  qty: number;                  // vendu aujourd'hui
  openingInventory: number;     // stock au matin
  closingInventory: number;     // stock actuel
  transfersIn: number;
  transfersOut: number;
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
  const [byProduct, setByProduct] = useState<ProductStockLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Observation : éditable, persistée via /daily-observation
  const [observation, setObservation] = useState('');
  const [obsAuthor, setObsAuthor] = useState<string | null>(null);
  const [savingObs, setSavingObs] = useState(false);
  const [savedObs, setSavedObs] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const today = todayIso();
      // Ventes du jour + agrégat stock par produit (même source que le PDF)
      const [salesRes, reportRes] = await Promise.allSettled([
        fetch(`/api/sales?dateFrom=${today}&dateTo=${today}`),
        fetch(`/api/outlets/${encodeURIComponent(outletId)}/daily-report?date=${today}`),
      ]);
      if (salesRes.status !== 'fulfilled' || !salesRes.value.ok) {
        throw new Error('Impossible de charger les ventes');
      }
      const { data } = await salesRes.value.json();
      const filtered: Sale[] = (data || []).filter((s: Sale) => s.OutletId === outletId);
      setSales(filtered);
      if (reportRes.status === 'fulfilled' && reportRes.value.ok) {
        try {
          const report = await reportRes.value.json();
          setByProduct(report.data?.byProduct ?? []);
        } catch { /* la section stock restera vide */ }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadObservation() {
    try {
      const r = await fetch(
        `/api/outlets/${encodeURIComponent(outletId)}/daily-observation?date=${todayIso()}`
      );
      if (!r.ok) return;
      const { data } = await r.json();
      setObservation(data.observation ?? '');
      setObsAuthor(data.authorName ?? null);
    } catch {
      /* silent */
    }
  }

  async function saveObservation() {
    setSavingObs(true);
    setSavedObs(false);
    try {
      const r = await fetch(
        `/api/outlets/${encodeURIComponent(outletId)}/daily-observation`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: todayIso(), observation }),
        }
      );
      if (!r.ok) throw new Error('Échec sauvegarde');
      setSavedObs(true);
      setTimeout(() => setSavedObs(false), 2500);
    } catch (e: any) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setSavingObs(false);
    }
  }

  useEffect(() => {
    void load();
    void loadObservation();
    // Poll des ventes seulement — pas l'observation, c'est éditée localement.
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

  // Fetch agrégat journalier + propage l'observation actuelle (au cas où
  // l'utilisateur a modifié le textarea sans cliquer Enregistrer juste avant
  // d'imprimer : on doit refléter ce qu'il voit).
  async function buildPdfData() {
    const r = await fetch(
      `/api/outlets/${encodeURIComponent(outletId)}/daily-report?date=${todayIso()}`
    );
    if (!r.ok) throw new Error('Erreur chargement journal');
    const { data } = await r.json();
    const obsForPdf = observation.trim()
      ? {
          text: observation.trim(),
          authorName: obsAuthor,
          updatedAt: new Date().toISOString(),
        }
      : data.observation;
    return {
      outletName: data.outlet.name,
      outletCode: data.outlet.code,
      date: data.date,
      sessions: data.sessions,
      byProduct: data.byProduct,
      bySeller: data.bySeller,
      deposits: data.deposits,
      totals: data.totals,
      observation: obsForPdf,
    };
  }

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

        {/* Boutons PDF */}
        <div className="px-5 py-2 border-b bg-amber-50 flex items-center gap-2">
          <p className="text-xs text-amber-800 flex-1">Journal complet du jour pour la direction :</p>
          <button
            onClick={async () => {
              try {
                const data = await buildPdfData();
                await shareStandJournalPdf(data);
              } catch (e: any) { alert(e.message); }
            }}
            className="px-2.5 py-1.5 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700 inline-flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> Partager
          </button>
          <button
            onClick={async () => {
              try {
                const data = await buildPdfData();
                downloadStandJournalPdf(data);
              } catch (e: any) { alert(e.message); }
            }}
            className="px-2.5 py-1.5 rounded-md border border-amber-300 bg-white text-amber-800 text-xs font-semibold hover:bg-amber-100 inline-flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
        </div>

        {/* Observation libre du commercial — apparaît dans le PDF */}
        <div className="px-5 py-3 border-b bg-stone-50">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Observation de la journée
            </label>
            {savedObs && (
              <span className="text-[11px] text-emerald-700 inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Enregistré
              </span>
            )}
          </div>
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Affluence, incidents, retours clients, ruptures…"
            rows={2}
            className="w-full text-sm px-2.5 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            maxLength={1000}
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-stone-500">
              {obsAuthor ? `Dernière saisie : ${obsAuthor}` : 'Sera visible dans le journal PDF.'}
            </p>
            <button
              onClick={saveObservation}
              disabled={savingObs}
              className="px-2.5 py-1 text-xs font-semibold border border-stone-300 bg-white rounded-md hover:bg-stone-100 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {savingObs && <Loader2 className="w-3 h-3 animate-spin" />}
              Enregistrer
            </button>
          </div>
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

        {/* Stock du jour par produit — matin, mouvements, vendu, soir.
            Même source que le PDF (/daily-report) : le vendeur et la
            direction voient le même inventaire. */}
        {byProduct.length > 0 && (
          <div className="border-t">
            <div className="px-5 pt-3 pb-1.5 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs uppercase font-semibold text-gray-600 tracking-wide">
                Stock du jour par produit
              </h3>
            </div>
            <div className="max-h-56 overflow-auto px-2 pb-2">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase text-gray-500 sticky top-0 bg-white">
                  <tr className="border-b">
                    <th className="text-left px-3 py-1.5">Produit</th>
                    <th className="text-right px-2 py-1.5" title="Stock au matin">Matin</th>
                    <th className="text-right px-2 py-1.5" title="Reçus dans la journée">Reçus</th>
                    <th className="text-right px-2 py-1.5" title="Envoyés vers d'autres stands">Envoyés</th>
                    <th className="text-right px-2 py-1.5" title="Vendus aujourd'hui">Vendus</th>
                    <th className="text-right px-3 py-1.5" title="Stock actuel">Soir</th>
                  </tr>
                </thead>
                <tbody>
                  {byProduct.map((p) => (
                    <tr key={p.code || p.name} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="px-3 py-1.5 truncate max-w-[160px]" title={p.name}>{p.name}</td>
                      <td className="px-2 py-1.5 text-right text-gray-700">{fmt(p.openingInventory)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {p.transfersIn > 0
                          ? <span className="text-purple-700 font-medium">+{fmt(p.transfersIn)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {p.transfersOut > 0
                          ? <span className="text-blue-700 font-medium">−{fmt(p.transfersOut)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {p.qty > 0
                          ? <span className="text-emerald-700 font-semibold">−{fmt(p.qty)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={'px-3 py-1.5 text-right font-bold ' + (p.closingInventory <= 0 ? 'text-red-600' : 'text-gray-900')}>
                        {fmt(p.closingInventory)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end px-5 py-3 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-100">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
