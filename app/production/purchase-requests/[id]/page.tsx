'use client';

/**
 * Page - Détail d'une sollicitation d'achat MP
 *
 * Actions selon statut + permissions :
 *   - draft + create   → soumettre
 *   - submitted + approve → approuver / refuser
 *   - approved + receive → réceptionner chaque ligne (recalcule PMP, met à jour stock)
 */
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, ArrowLeft, Send, CheckCircle, XCircle, Package,
  AlertTriangle, Clock, X, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { useHasRole } from '@/lib/rbac/use-permissions';
import { useSession } from 'next-auth/react';
import { ExpensePaymentPanel } from '@/components/expenses/expense-payment-panel';
import { Factory } from 'lucide-react';
import Link from 'next/link';

const INP = 'w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-amber-500';
const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  submitted: { label: 'À valider', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  approved: { label: 'Approuvée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Refusée', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

export default function PurchaseRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedPage permission={PERMISSIONS.PURCHASE_REQUEST_VIEW}>
      <Content id={id} />
    </ProtectedPage>
  );
}

function Content({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  // Approbation/refus = strictement réservés au rôle 'admin' (Administrateur
  // Décideur). On vérifie par business code de rôle, plus strict qu'une
  // permission qui aurait pu être distribuée trop largement.
  const { hasRole: isAdmin, loading: roleLoading } = useHasRole('admin');
  const [pr, setPr] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivingLine, setReceivingLine] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/production/purchase-requests/${id}`);
      if (!r.ok) throw new Error('Sollicitation introuvable');
      setPr((await r.json()).data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function action(path: string, body?: any) {
    setBusy(path);
    setError(null);
    try {
      const r = await fetch(`/api/production/purchase-requests/${id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" /></div>;
  }
  if (!pr) {
    return <div className="p-8 text-center text-gray-500">Sollicitation introuvable.</div>;
  }

  const config = STATUS_CONFIG[pr.Status] || STATUS_CONFIG.draft;
  const Icon = config.icon;
  const lines = pr.Lines || [];
  const totalReq = lines.reduce((s: number, l: any) => s + Number(l.QtyRequested), 0);
  const totalRec = lines.reduce((s: number, l: any) => s + Number(l.QtyReceived), 0);
  const totalActual = lines.reduce((s: number, l: any) => s + Number(l.ActualTotal), 0);
  const fullyReceived = lines.length > 0 && lines.every((l: any) => Number(l.QtyReceived) >= Number(l.QtyRequested));

  // Lien OP : si toutes les lignes pointent vers le même OP, on affiche un bandeau global.
  const opIds = new Set(lines.map((l: any) => l.ProductionOrderId).filter(Boolean));
  const linkedOpId = opIds.size === 1 ? (lines.find((l: any) => l.ProductionOrderId) as any) : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{pr.Title}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
                  <span className="bg-white/20 px-2 py-0.5 rounded">{pr.RequestNumber}</span>
                  <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${config.color}`}>
                    <Icon className="w-3 h-3" /> {config.label}
                  </span>
                  {fullyReceived && <span className="bg-green-500/40 px-2 py-0.5 rounded">Tout reçu</span>}
                </div>
              </div>
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

        {linkedOpId && (
          <Link
            href={`/production/orders/${linkedOpId.ProductionOrderId}`}
            className="block bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Factory className="w-5 h-5 text-orange-600" />
              <div className="flex-1">
                <p className="text-sm text-orange-900">
                  Sollicitation pour l'ordre de production{' '}
                  <strong className="font-mono">{linkedOpId.ProductionOrderNumber || linkedOpId.ProductionOrderId}</strong>
                </p>
                <p className="text-xs text-orange-700/80">Cliquer pour voir l'OP</p>
              </div>
            </div>
          </Link>
        )}

        {/* Synthèse */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Montant estimé" value={`${fmt(pr.Amount)} XOF`} />
            <Stat label="Lignes" value={String(lines.length)} />
            <Stat label="Reçu" value={`${fmt(totalRec)} / ${fmt(totalReq)}`} />
            <Stat label="Coût réel cumulé" value={`${fmt(totalActual)} XOF`} hint={pr.Status === 'approved' ? 'maj à chaque réception' : '—'} />
          </div>
        </div>

        {pr.Description && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold mb-2">Description / motif</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{pr.Description}</p>
          </div>
        )}

        {/* Actions workflow */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold mb-3">Actions</h2>
          <div className="flex gap-2 flex-wrap">
            {pr.Status === 'draft' && (
              <Can permission={PERMISSIONS.PURCHASE_REQUEST_CREATE}>
                <Button onClick={() => action('submit')} disabled={busy !== null} className="bg-amber-600 hover:bg-amber-700">
                  <Send className="w-4 h-4 mr-1" /> Soumettre à validation
                </Button>
              </Can>
            )}
            {pr.Status === 'submitted' && !roleLoading && (() => {
              const currentUserId = (session?.user as any)?.userId;
              const isRequester = !!currentUserId && currentUserId === pr.RequesterUserId;
              if (!isAdmin) {
                return (
                  <p className="text-sm text-gray-600 self-center italic">
                    En attente d'approbation par un Administrateur Décideur.
                  </p>
                );
              }
              if (isRequester) {
                return (
                  <p className="text-sm text-gray-600 self-center italic">
                    Vous avez soumis cette sollicitation : un autre administrateur doit l'approuver (séparation des pouvoirs).
                  </p>
                );
              }
              return (
                <>
                  <Button onClick={() => action('approve')} disabled={busy !== null} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 mr-1" /> Approuver
                  </Button>
                  <Button onClick={() => setRejectReason('')} disabled={busy !== null} variant="outline" className="border-red-400 text-red-600 hover:bg-red-50">
                    <XCircle className="w-4 h-4 mr-1" /> Refuser
                  </Button>
                </>
              );
            })()}
            {pr.Status === 'approved' && !fullyReceived && (
              <Can permission={PERMISSIONS.PURCHASE_REQUEST_RECEIVE}>
                <p className="text-sm text-gray-600 self-center">→ Sélectionnez une ligne pour enregistrer sa réception.</p>
              </Can>
            )}
            {pr.Status === 'approved' && fullyReceived && (
              <p className="text-sm text-green-700 self-center">✅ Toutes les lignes ont été réceptionnées.</p>
            )}
            {(pr.Status === 'rejected' || pr.Status === 'cancelled') && (
              <p className="text-sm text-gray-500 self-center">Sollicitation finalisée — pas d'action possible.</p>
            )}
          </div>
        </div>

        <ExpensePaymentPanel expenseRequestId={pr.ExpenseRequestId} />

        {/* Lignes */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Package className="w-5 h-5" /> Lignes ({lines.length})</h2>
          {lines.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">Aucune ligne.</div>
          ) : (
            <div className="divide-y">
              {lines.map((line: any) => {
                const req = Number(line.QtyRequested);
                const rec = Number(line.QtyReceived);
                const fullyRecLine = rec >= req;
                return (
                  <div key={line.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{line.IngredientName}</p>
                      <p className="text-sm text-gray-600">
                        Demandé : <strong>{fmt(req)} {line.Unit}</strong> × {fmt(line.EstimatedUnitPrice)} XOF = {fmt(line.EstimatedTotal)} XOF
                      </p>
                      {rec > 0 && (
                        <p className={`text-sm ${fullyRecLine ? 'text-green-700' : 'text-amber-700'}`}>
                          Reçu : <strong>{fmt(rec)} {line.Unit}</strong> · coût réel {fmt(line.ActualTotal)} XOF
                          {fullyRecLine ? ' · ✅' : ` · reste ${fmt(req - rec)} ${line.Unit}`}
                        </p>
                      )}
                    </div>
                    {pr.Status === 'approved' && !fullyRecLine && (
                      <Can permission={PERMISSIONS.PURCHASE_REQUEST_RECEIVE}>
                        <Button onClick={() => setReceivingLine(line)} size="sm" variant="outline">
                          Réceptionner
                        </Button>
                      </Can>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {receivingLine && (
        <ReceiveLineModal
          line={receivingLine}
          prId={id}
          onClose={() => setReceivingLine(null)}
          onReceived={() => { setReceivingLine(null); load(); }}
        />
      )}
      {rejectReason !== null && (
        <RejectModal
          reason={rejectReason}
          setReason={setRejectReason}
          onCancel={() => setRejectReason(null)}
          onConfirm={async () => {
            await action('reject', { reason: rejectReason });
            setRejectReason(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function ReceiveLineModal({ line, prId, onClose, onReceived }: {
  line: any;
  prId: string;
  onClose: () => void;
  onReceived: () => void;
}) {
  // Unité native de la ligne (telle que définie sur l'ingrédient). En général
  // "g" pour les MP de pâtisserie. On garde un sélecteur kg/g côté UI pour
  // que le manager saisisse dans l'unité qui lui parle, on convertit avant
  // d'envoyer au backend.
  const nativeUnit = (line.Unit || 'g').toString().toLowerCase();
  const remainingNative = Number(line.QtyRequested) - Number(line.QtyReceived);

  // L'unité de saisie par défaut suit l'unité native si c'est kg/g, sinon kg.
  const defaultInputUnit: 'kg' | 'g' = (nativeUnit === 'kg' || nativeUnit === 'g') ? (nativeUnit as any) : 'kg';
  const [inputUnit, setInputUnit] = useState<'kg' | 'g'>(defaultInputUnit);
  const [qtyInput, setQtyInput] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conversions entre l'unité saisie et l'unité native de la ligne (au cas
  // où l'ingrédient est défini avec une unité différente de celle saisie).
  function toNative(value: number, fromUnit: 'kg' | 'g'): number {
    if (fromUnit === nativeUnit) return value;
    if (fromUnit === 'kg' && nativeUnit === 'g') return value * 1000;
    if (fromUnit === 'g' && nativeUnit === 'kg') return value / 1000;
    return value;
  }
  function fromNative(value: number, toUnit: 'kg' | 'g'): number {
    if (toUnit === nativeUnit) return value;
    if (toUnit === 'kg' && nativeUnit === 'g') return value / 1000;
    if (toUnit === 'g' && nativeUnit === 'kg') return value * 1000;
    return value;
  }

  const remainingInInputUnit = fromNative(remainingNative, inputUnit);
  const qtyN = Number(qtyInput) || 0;
  const totalN = Number(totalAmount) || 0;
  const qtyNative = toNative(qtyN, inputUnit);
  const unitPriceNative = qtyNative > 0 ? totalN / qtyNative : 0;
  const unitPriceInInputUnit = qtyN > 0 ? totalN / qtyN : 0;

  const fmtPrice = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);

  async function submit() {
    if (!qtyN || qtyN <= 0) { setError('Quantité reçue requise (> 0)'); return; }
    if (!totalN || totalN <= 0) { setError('Montant total payé requis (> 0)'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/production/purchase-requests/${prId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseRequestLineId: line.PurchaseRequestLineId,
          qty: qtyNative,
          unitPrice: unitPriceNative,
          notes: notes || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur réception');
      onReceived();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={`Réception : ${line.IngredientName}`} onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <p className="text-sm bg-gray-50 p-3 rounded-lg">
        Demandé : <strong>{fmt(line.QtyRequested)} {nativeUnit}</strong> · Reste à recevoir : <strong>{fmt(remainingInInputUnit)} {inputUnit}</strong>
      </p>

      <div className="grid grid-cols-3 gap-2">
        <label className="block col-span-2">
          <span className="block text-sm font-medium text-gray-700 mb-1">Quantité reçue*</span>
          <input
            type="number" min="0" step="0.001"
            className={INP}
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            placeholder={`ex: ${fmt(remainingInInputUnit)}`}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Unité</span>
          <select
            className={INP}
            value={inputUnit}
            onChange={(e) => setInputUnit(e.target.value as 'kg' | 'g')}
          >
            <option value="kg">kg</option>
            <option value="g">g</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Montant total payé (XOF)*</span>
        <input
          type="number" min="0" step="1"
          className={INP}
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          placeholder="ex: 25000"
        />
      </label>

      {qtyN > 0 && totalN > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          <span className="text-gray-600">Coût unitaire effectif : </span>
          <strong className="text-amber-900">{fmtPrice(unitPriceInInputUnit)} XOF/{inputUnit}</strong>
          {inputUnit !== nativeUnit && (
            <span className="text-xs text-gray-500 ml-2">(soit {fmtPrice(unitPriceNative)} XOF/{nativeUnit})</span>
          )}
        </div>
      )}

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Notes</span>
        <textarea className={INP + ' h-auto py-2'} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        Cette réception va incrémenter le stock MP de {fmt(qtyNative)} {nativeUnit}, recalculer le PMP courant et tracer l'opération.
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
        <Button onClick={submit} disabled={busy} className="flex-1 h-11 bg-green-600 hover:bg-green-700">
          <Save className="w-4 h-4 mr-1" /> {busy ? 'Réception…' : 'Confirmer'}
        </Button>
      </div>
    </Modal>
  );
}

function RejectModal({ reason, setReason, onCancel, onConfirm }: {
  reason: string;
  setReason: (r: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Refuser la sollicitation" onClose={onCancel}>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Motif (visible dans l'historique)</span>
        <textarea className={INP + ' h-auto py-2'} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-11">Annuler</Button>
        <Button onClick={onConfirm} className="flex-1 h-11 bg-red-600 hover:bg-red-700">
          Confirmer le refus
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
