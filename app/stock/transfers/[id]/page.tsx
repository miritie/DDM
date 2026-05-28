'use client';

/**
 * Page - Détail d'un transfert de stock
 *
 * Actions selon contexte :
 *  - Émetteur : peut annuler tant que pas fully_received ; peut décider du
 *    sort des écarts ajustés
 *  - Destinataire d'une ligne : peut confirmer (full / partiel) ou refuser
 *    sa ligne tant qu'elle est pending
 */
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft, ArrowLeft, Package, CheckCircle, XCircle, AlertCircle,
  Clock, X, Save, Warehouse as WarehouseIcon, Store, AlertTriangle, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:              { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  in_transit:         { label: 'En transit', color: 'bg-blue-100 text-blue-700', icon: ArrowRightLeft },
  partially_received: { label: 'Partiellement reçu', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  fully_received:     { label: 'Reçu', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled:          { label: 'Annulé', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const LEG_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmée', color: 'bg-green-100 text-green-700' },
  adjusted:  { label: 'Ajustée', color: 'bg-orange-100 text-orange-700' },
  refused:   { label: 'Refusée', color: 'bg-red-100 text-red-700' },
  recalled:  { label: 'Rappelée', color: 'bg-gray-200 text-gray-700' },
};

const INP = 'w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-cyan-500';

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <Content id={id} />
    </ProtectedPage>
  );
}

function Content({ id }: { id: string }) {
  const router = useRouter();
  const [transfer, setTransfer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingLine, setConfirmingLine] = useState<any | null>(null);
  const [refusingLine, setRefusingLine] = useState<any | null>(null);
  const [shortfallLine, setShortfallLine] = useState<any | null>(null);
  const [recallingLine, setRecallingLine] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/stock/transfers/${id}`);
      if (!r.ok) throw new Error('Transfert introuvable');
      setTransfer((await r.json()).data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  async function cancel() {
    if (!confirm('Annuler ce transfert ? Les lignes non encore réceptionnées seront retournées à la source.')) return;
    try {
      const r = await fetch(`/api/stock/transfers/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      load();
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600" /></div>;
  if (!transfer) return <div className="p-8 text-center text-gray-500">{error || 'Transfert introuvable'}</div>;

  const cfg = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  const lines = transfer.lines || [];
  const sourceName = transfer.source_warehouse_name || transfer.source_outlet_name;
  const sourceType = transfer.source_warehouse_id ? 'warehouse' : 'outlet';
  const canCancel = transfer.status === 'in_transit' || transfer.status === 'partially_received';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-7 h-7" /> {transfer.transfer_number}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-sm">
                <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${cfg.color}`}>
                  <Icon className="w-3 h-3" /> {cfg.label}
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded flex items-center gap-1">
                  {sourceType === 'warehouse' ? <WarehouseIcon className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                  Source: {sourceName}
                </span>
              </div>
            </div>
            <Can permission={PERMISSIONS.STOCK_TRANSFER}>
              {canCancel && (
                <Button onClick={cancel} variant="outline" className="bg-white/20 hover:bg-white/30 border-white/40 text-white">
                  <XCircle className="w-4 h-4 mr-1" /> Annuler
                </Button>
              )}
            </Can>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {/* Infos */}
        <div className="bg-white rounded-2xl shadow-xl p-6 text-sm">
          <h2 className="font-bold mb-3">Informations</h2>
          <dl className="grid grid-cols-2 gap-3">
            <dt className="text-gray-500">Émis par</dt><dd>{transfer.initiated_by_name || '—'}</dd>
            <dt className="text-gray-500">Émis le</dt><dd>{fmtDateTime(transfer.initiated_at)}</dd>
            <dt className="text-gray-500">Clos le</dt><dd>{fmtDateTime(transfer.closed_at)}</dd>
            <dt className="text-gray-500">Lignes</dt><dd>{lines.length}</dd>
          </dl>
          {transfer.notes && (
            <div className="pt-3 mt-3 border-t">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="whitespace-pre-wrap text-gray-700">{transfer.notes}</p>
            </div>
          )}
        </div>

        {/* Lignes */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Package className="w-5 h-5" /> Lignes ({lines.length})</h2>
          <div className="space-y-2">
            {lines.map((l: any) => {
              const lc = LEG_CONFIG[l.leg_status] || LEG_CONFIG.pending;
              const destName = l.destination_warehouse_name || l.destination_outlet_name;
              const destType = l.destination_warehouse_id ? 'warehouse' : 'outlet';
              const shortfall = Number(l.qty_sent) - Number(l.qty_received);
              const isAdjusted = l.leg_status === 'adjusted';
              const needsDecision = isAdjusted && l.shortfall_decision === 'pending';
              return (
                <div key={l.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold">{l.product_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${lc.color}`}>{lc.label}</span>
                        {needsDecision && (
                          <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-medium animate-pulse">
                            Écart à arbitrer
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {destType === 'warehouse' ? '🏭' : '🏪'} <strong>{destName}</strong>
                        {' · '}envoyée: <strong>{fmt(l.qty_sent)} {l.unit}</strong>
                        {l.leg_status !== 'pending' && (
                          <>
                            {' · '}reçue: <strong>{fmt(l.qty_received)} {l.unit}</strong>
                            {shortfall > 0 && <span className="text-orange-600"> (écart {fmt(shortfall)})</span>}
                          </>
                        )}
                      </p>
                      {l.adjustment_reason && (
                        <p className="text-xs text-gray-500 mt-1">Raison ajustement : {l.adjustment_reason}</p>
                      )}
                      {l.leg_status !== 'pending' && (
                        <p className="text-xs text-gray-400 mt-1">
                          par {l.confirmed_by_name || '?'} · {fmtDateTime(l.confirmed_at)}
                        </p>
                      )}
                      {isAdjusted && l.shortfall_decision !== 'pending' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Écart arbitré : <strong>{l.shortfall_decision === 'declared_loss' ? 'Perte transit' : 'Retour à la source'}</strong>
                          {' '}par {l.shortfall_decided_by_name || '?'} · {fmtDateTime(l.shortfall_decided_at)}
                        </p>
                      )}
                    </div>
                    <Can permission={PERMISSIONS.STOCK_TRANSFER}>
                      <div className="flex flex-col gap-1 shrink-0">
                        {l.leg_status === 'pending' && (
                          <>
                            <button onClick={() => setConfirmingLine(l)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Confirmer
                            </button>
                            <button onClick={() => setRefusingLine(l)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Refuser
                            </button>
                            {transfer.isInitiator && (
                              <button onClick={() => setRecallingLine(l)} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-medium flex items-center gap-1" title="Récupérer la ligne (seul l'émetteur peut)">
                                <RotateCcw className="w-3 h-3" /> Rappeler
                              </button>
                            )}
                          </>
                        )}
                        {needsDecision && (
                          <button onClick={() => setShortfallLine(l)} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Arbitrer écart
                          </button>
                        )}
                      </div>
                    </Can>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {confirmingLine && (
        <ConfirmModal line={confirmingLine} onClose={() => setConfirmingLine(null)} onDone={() => { setConfirmingLine(null); load(); }} />
      )}
      {refusingLine && (
        <RefuseModal line={refusingLine} onClose={() => setRefusingLine(null)} onDone={() => { setRefusingLine(null); load(); }} />
      )}
      {shortfallLine && (
        <ShortfallModal line={shortfallLine} onClose={() => setShortfallLine(null)} onDone={() => { setShortfallLine(null); load(); }} />
      )}
      {recallingLine && (
        <RecallModal line={recallingLine} onClose={() => setRecallingLine(null)} onDone={() => { setRecallingLine(null); load(); }} />
      )}
    </div>
  );
}

function RecallModal({ line, onClose, onDone }: { line: any; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/stock/transfers/lines/${line.transfer_line_id}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      onDone();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={`Rappeler : ${line.product_name}`} onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <p className="text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-900">
        En tant qu'émetteur, tu retires cette ligne du destinataire. Les <strong>{fmt(line.qty_sent)} {line.unit}</strong> retournent immédiatement au stock source.
      </p>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Motif (optionnel)</span>
        <textarea className={INP + ' h-auto py-2'} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex: erreur de quantité, redirection vers un autre stand…" />
      </label>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Retour</Button>
        <Button onClick={submit} disabled={busy} className="flex-1 h-11 bg-gray-700 hover:bg-gray-800">
          <RotateCcw className="w-4 h-4 mr-1" /> {busy ? 'Rappel…' : 'Confirmer le rappel'}
        </Button>
      </div>
    </Modal>
  );
}

function ConfirmModal({ line, onClose, onDone }: { line: any; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState(String(line.qty_sent));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdjustment = Number(qty) < Number(line.qty_sent);

  async function submit() {
    if (!qty || Number(qty) <= 0) { setError('Quantité invalide'); return; }
    if (Number(qty) > Number(line.qty_sent)) { setError(`Max ${line.qty_sent}`); return; }
    if (isAdjustment && !reason.trim()) { setError('Motif requis pour une réception partielle'); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/stock/transfers/lines/${line.transfer_line_id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qtyReceived: Number(qty), adjustmentReason: reason || undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      onDone();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={`Réception : ${line.product_name}`} onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <p className="text-sm bg-gray-50 p-3 rounded-lg">
        Envoyée : <strong>{fmt(line.qty_sent)} {line.unit}</strong>
      </p>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Quantité reçue ({line.unit})*</span>
        <input type="number" min="0" max={line.qty_sent} step="1" className={INP} value={qty} onChange={(e) => setQty(e.target.value)} />
      </label>
      {isAdjustment && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            ⚠ Quantité ajustée : écart de <strong>{fmt(Number(line.qty_sent) - Number(qty))} {line.unit}</strong>.
            L'émetteur décidera ensuite (perte transit ou retour à la source).
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Motif de l'ajustement*</span>
            <textarea className={INP + ' h-auto py-2'} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex: casse transport, manque physique…" />
          </label>
        </>
      )}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
        <Button onClick={submit} disabled={busy} className="flex-1 h-11 bg-green-600 hover:bg-green-700">
          <Save className="w-4 h-4 mr-1" /> {busy ? 'Confirmation…' : 'Confirmer'}
        </Button>
      </div>
    </Modal>
  );
}

function RefuseModal({ line, onClose, onDone }: { line: any; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/stock/transfers/lines/${line.transfer_line_id}/refuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      onDone();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  return (
    <Modal title={`Refuser : ${line.product_name}`} onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <p className="text-sm bg-red-50 border border-red-200 rounded-lg p-3 text-red-900">
        En refusant cette ligne, les <strong>{fmt(line.qty_sent)} {line.unit}</strong> de <strong>{line.product_name}</strong> seront retournés au stock source.
      </p>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Motif (recommandé)</span>
        <textarea className={INP + ' h-auto py-2'} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Retour</Button>
        <Button onClick={submit} disabled={busy} className="flex-1 h-11 bg-red-600 hover:bg-red-700">
          Confirmer le refus
        </Button>
      </div>
    </Modal>
  );
}

function ShortfallModal({ line, onClose, onDone }: { line: any; onClose: () => void; onDone: () => void }) {
  const [decision, setDecision] = useState<'declared_loss' | 'returned_to_source' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shortfall = Number(line.qty_sent) - Number(line.qty_received);

  async function submit() {
    if (!decision) { setError('Choisis une option'); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/stock/transfers/lines/${line.transfer_line_id}/shortfall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      onDone();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Arbitrer l'écart" onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <p className="text-sm bg-orange-50 border border-orange-200 rounded-lg p-3 text-orange-900">
        Écart de <strong>{fmt(shortfall)} {line.unit}</strong> sur <strong>{line.product_name}</strong>.
        <br />Raison saisie : <em>{line.adjustment_reason || '—'}</em>
      </p>
      <div className="space-y-2">
        <button
          onClick={() => setDecision('declared_loss')}
          className={`w-full text-left p-3 rounded-lg border-2 ${decision === 'declared_loss' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
        >
          <p className="font-semibold text-red-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Perte transit</p>
          <p className="text-xs text-gray-600 mt-1">L'écart est perdu (casse, vol, dégradation). Le stock total diminue de {fmt(shortfall)}.</p>
        </button>
        <button
          onClick={() => setDecision('returned_to_source')}
          className={`w-full text-left p-3 rounded-lg border-2 ${decision === 'returned_to_source' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
        >
          <p className="font-semibold text-green-900 flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Retour à la source</p>
          <p className="text-xs text-gray-600 mt-1">L'écart retourne au stock source (jamais sorti physiquement). Stock total inchangé.</p>
        </button>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
        <Button onClick={submit} disabled={busy || !decision} className="flex-1 h-11 bg-cyan-600 hover:bg-cyan-700">
          {busy ? 'Enregistrement…' : 'Confirmer la décision'}
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
