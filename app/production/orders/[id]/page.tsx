'use client';

/**
 * Page - Détail d'un Ordre de Production
 *
 * Workflow : draft → submitted → planned → in_progress → completed
 * Actions selon statut + permissions :
 *   - draft + production:submit       → soumettre
 *   - submitted + production:approve  → approuver / annuler
 *   - planned + production:start      → démarrer (vérifie stock MP)
 *   - in_progress + production:edit   → consommer ingrédients, créer un lot
 *   - in_progress + production:complete → terminer (≥1 lot)
 *   - tout sauf completed             → annuler
 */
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Factory, ArrowLeft, Send, CheckCircle, XCircle, PlayCircle, Package, Beaker,
  Clock, AlertTriangle, X, Save, FileText, Calendar, TrendingUp, ListChecks, Plus,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import type { ProductionOrder, IngredientConsumption } from '@/types/modules';

const INP = 'w-full h-11 px-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-orange-500';
const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));
const fmtDateShort = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  submitted: { label: 'À valider', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  planned: { label: 'Planifié', color: 'bg-blue-100 text-blue-700', icon: Calendar },
  in_progress: { label: 'En cours', color: 'bg-orange-100 text-orange-700', icon: PlayCircle },
  completed: { label: 'Terminé', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function ProductionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedPage permission={PERMISSIONS.PRODUCTION_VIEW}>
      <Content id={id} />
    </ProtectedPage>
  );
}

function Content({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConsume, setShowConsume] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/production/orders/${id}`);
      if (!r.ok) throw new Error('Ordre introuvable');
      setOrder((await r.json()).data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function callAction(path: string, body?: any) {
    setBusy(path);
    setError(null);
    try {
      const r = await fetch(`/api/production/orders/${id}/${path}`, {
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
    return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" /></div>;
  }
  if (!order) {
    return <div className="p-8 text-center text-gray-500">Ordre introuvable.</div>;
  }

  const config = STATUS_CONFIG[order.Status] || STATUS_CONFIG.draft;
  const Icon = config.icon;
  const cons = order.IngredientConsumptions || [];
  const batches = order.Batches || [];
  const totalGood = batches.reduce((s, b) => s + Number(b.QuantityGood), 0);
  const totalDefective = batches.reduce((s, b) => s + Number(b.QuantityDefective), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 pb-10">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Factory className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{order.ProductName || order.RecipeName}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-sm">
                <span className="bg-white/20 px-2 py-0.5 rounded">{order.OrderNumber}</span>
                <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${config.color}`}>
                  <Icon className="w-3 h-3" /> {config.label}
                </span>
                {order.Priority && (
                  <span className="bg-white/20 px-2 py-0.5 rounded">Priorité {order.Priority}</span>
                )}
                {order.CustomerOrderId && (
                  <span className="bg-white/20 px-2 py-0.5 rounded">↳ Commande client</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex gap-2 items-start">
            <AlertTriangle className="w-5 h-5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Quantité planifiée" value={`${fmt(order.PlannedQuantity)} ${order.Unit}`} />
            <Stat label="Produite" value={`${fmt(order.ProducedQuantity)} ${order.Unit}`} />
            <Stat label="Rendement" value={`${fmt(order.YieldRate)} %`} hint={`${fmt(totalGood)} bons, ${fmt(totalDefective)} défects`} />
            <Stat label="Coût matière" value={`${fmt(order.TotalCost)} XOF`} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-2 text-sm">
          <h2 className="font-bold mb-2">Informations</h2>
          <div className="grid grid-cols-2 gap-3">
            <Info label="Recette" value={`${order.RecipeName ?? '—'}${order.RecipeVersion ? ` (v${order.RecipeVersion})` : ''}`} />
            <Info label="Assignation" value={order.AssignedToName ?? '—'} />
            <Info label="Début planifié" value={fmtDateShort(order.PlannedStartDate)} />
            <Info label="Fin planifiée" value={fmtDateShort(order.PlannedEndDate)} />
            <Info label="Soumis le" value={fmtDateTime(order.SubmittedAt)} />
            <Info label="Approuvé le" value={fmtDateTime(order.ApprovedAt)} />
            <Info label="Démarrage réel" value={fmtDateTime(order.ActualStartDate)} />
            <Info label="Fin réelle" value={fmtDateTime(order.ActualEndDate)} />
          </div>
          {order.Notes && (
            <div className="pt-3 border-t mt-3">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="whitespace-pre-wrap text-gray-700">{order.Notes}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-orange-600" /> Actions
          </h2>
          <div className="flex flex-wrap gap-2">
            {order.Status === 'draft' && (
              <>
                <Can permission={PERMISSIONS.PRODUCTION_SUBMIT}>
                  <Button onClick={() => callAction('submit')} disabled={busy !== null} className="bg-amber-600 hover:bg-amber-700">
                    <Send className="w-4 h-4 mr-1" /> Soumettre à validation
                  </Button>
                </Can>
                <Button onClick={() => setCancelReason('')} disabled={busy !== null} variant="outline" className="border-red-400 text-red-600 hover:bg-red-50">
                  <XCircle className="w-4 h-4 mr-1" /> Annuler
                </Button>
              </>
            )}
            {order.Status === 'submitted' && (
              <Can permission={PERMISSIONS.PRODUCTION_APPROVE}>
                <Button onClick={() => callAction('approve')} disabled={busy !== null} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="w-4 h-4 mr-1" /> Approuver
                </Button>
                <Button onClick={() => setCancelReason('')} disabled={busy !== null} variant="outline" className="border-red-400 text-red-600 hover:bg-red-50">
                  <XCircle className="w-4 h-4 mr-1" /> Refuser / Annuler
                </Button>
              </Can>
            )}
            {order.Status === 'planned' && (
              <Can permission={PERMISSIONS.PRODUCTION_START}>
                <Button onClick={() => callAction('start')} disabled={busy !== null} className="bg-orange-600 hover:bg-orange-700">
                  <PlayCircle className="w-4 h-4 mr-1" /> Démarrer la fabrication
                </Button>
                <Button onClick={() => setCancelReason('')} disabled={busy !== null} variant="outline" className="border-red-400 text-red-600 hover:bg-red-50">
                  <XCircle className="w-4 h-4 mr-1" /> Annuler
                </Button>
              </Can>
            )}
            {order.Status === 'in_progress' && (
              <Can permission={PERMISSIONS.PRODUCTION_EDIT}>
                <Button onClick={() => setShowConsume(true)} disabled={busy !== null}>
                  <Beaker className="w-4 h-4 mr-1" /> Saisir consommations
                </Button>
                <Button onClick={() => setShowBatch(true)} disabled={busy !== null}>
                  <Package className="w-4 h-4 mr-1" /> Créer un lot
                </Button>
                <Can permission={PERMISSIONS.PRODUCTION_COMPLETE}>
                  <Button onClick={() => callAction('complete')} disabled={busy !== null || batches.length === 0} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 mr-1" /> Terminer
                  </Button>
                </Can>
                <Button onClick={() => setCancelReason('')} disabled={busy !== null} variant="outline" className="border-red-400 text-red-600 hover:bg-red-50">
                  <XCircle className="w-4 h-4 mr-1" /> Annuler
                </Button>
              </Can>
            )}
            {(order.Status === 'completed' || order.Status === 'cancelled') && (
              <p className="text-sm text-gray-500 self-center">Ordre finalisé — aucune action possible.</p>
            )}

            {/* Solliciter MP : transversal (tant que l'OP n'est pas finalisé) */}
            {order.Status !== 'completed' && order.Status !== 'cancelled' && (
              <Can permission={PERMISSIONS.PURCHASE_REQUEST_CREATE}>
                <Button
                  onClick={() => {
                    const payload = {
                      productionOrderId: order.id,
                      lines: cons.map((c: any) => ({
                        ingredientId: c.IngredientId,
                        plannedQty: Number(c.PlannedQuantity) || 0,
                        plannedUnit: c.Unit || '',
                      })),
                    };
                    try {
                      sessionStorage.setItem('purchaseRequestPrefill', JSON.stringify(payload));
                    } catch { /* sessionStorage indispo — on continue, le form sera vide */ }
                    router.push(`/production/purchase-requests/new?productionOrderId=${order.id}&prefill=1`);
                  }}
                  disabled={busy !== null || cons.length === 0}
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-50"
                  title={cons.length === 0 ? 'Aucun ingrédient planifié sur cet ordre' : 'Solliciter les MP nécessaires à cet OP'}
                >
                  <ShoppingCart className="w-4 h-4 mr-1" /> Solliciter les MP
                </Button>
              </Can>
            )}
          </div>
        </div>

        {/* Consommations */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Beaker className="w-5 h-5 text-purple-600" /> Consommations matières
          </h2>
          {cons.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">Aucune consommation prévue.</div>
          ) : (
            <div className="divide-y">
              {cons.map((c) => {
                const planned = Number(c.PlannedQuantity);
                const actual = Number(c.ActualQuantity);
                const variance = Number(c.Variance);
                return (
                  <div key={c.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{c.IngredientName}</p>
                      <p className="text-sm text-gray-600">
                        Prévu : <strong>{fmt(planned)} {c.Unit}</strong>
                        {actual > 0 && (
                          <>
                            {' '}· Réel : <strong>{fmt(actual)} {c.Unit}</strong> · {fmt(c.TotalCost)} XOF
                            {Math.abs(variance) > 0.01 && (
                              <span className={` ml-2 ${variance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                ({variance > 0 ? '+' : ''}{variance.toFixed(1)}%)
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lots produits */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" /> Lots produits ({batches.length})
          </h2>
          {batches.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">Aucun lot produit pour cet ordre.</div>
          ) : (
            <div className="divide-y">
              {batches.map((b) => (
                <div key={b.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{b.BatchNumber}</p>
                      <p className="text-sm text-gray-600">
                        {fmt(b.QuantityGood)} bons{Number(b.QuantityDefective) > 0 && <>, {fmt(b.QuantityDefective)} défects</>} · {fmt(b.QuantityProduced)} produits
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{fmtDateShort(b.ProductionDate)}</p>
                      {b.QualityScore != null && (
                        <p className="text-sm font-semibold text-green-700">Q {b.QualityScore}/100</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showConsume && (
        <ConsumeModal
          orderId={id}
          consumptions={cons}
          onClose={() => setShowConsume(false)}
          onSaved={() => { setShowConsume(false); load(); }}
        />
      )}
      {showBatch && (
        <BatchModal
          orderId={id}
          remaining={Math.max(0, Number(order.PlannedQuantity) - Number(order.ProducedQuantity))}
          onClose={() => setShowBatch(false)}
          onSaved={() => { setShowBatch(false); load(); }}
        />
      )}
      {cancelReason !== null && (
        <CancelModal
          reason={cancelReason}
          setReason={setCancelReason}
          onCancel={() => setCancelReason(null)}
          onConfirm={async () => {
            await callAction('cancel', { reason: cancelReason });
            setCancelReason(null);
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
      <p className="text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}

function ConsumeModal({ orderId, consumptions, onClose, onSaved }: {
  orderId: string;
  consumptions: IngredientConsumption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(consumptions.map((c) => [c.IngredientId, String(c.ActualQuantity || c.PlannedQuantity)]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const ingredients = consumptions
        .map((c) => ({
          ingredientId: c.IngredientId,
          actualQuantity: Number(values[c.IngredientId]),
        }))
        .filter((i) => i.actualQuantity > 0);
      const r = await fetch(`/api/production/orders/${orderId}/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Saisir les consommations réelles" onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <p className="text-sm text-gray-600">
        Saisissez la quantité réellement consommée pour chaque ingrédient. Le stock MP sera décrémenté.
      </p>
      <div className="space-y-2">
        {consumptions.map((c) => (
          <div key={c.id} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm">{c.IngredientName}</p>
              <p className="text-xs text-gray-500">Prévu : {fmt(c.PlannedQuantity)} {c.Unit}</p>
            </div>
            <div className="flex gap-2">
              <input
                type="number" min="0" step="0.001"
                className={INP + ' flex-1'}
                value={values[c.IngredientId] ?? ''}
                onChange={(e) => setValues({ ...values, [c.IngredientId]: e.target.value })}
              />
              <span className="self-center text-sm text-gray-500">{c.Unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
        <Button onClick={submit} disabled={busy} className="flex-1 h-11 bg-orange-600 hover:bg-orange-700">
          <Save className="w-4 h-4 mr-1" /> {busy ? 'Enregistrement…' : 'Confirmer'}
        </Button>
      </div>
    </Modal>
  );
}

function BatchModal({ orderId, remaining, onClose, onSaved }: {
  orderId: string;
  remaining: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [produced, setProduced] = useState(String(remaining));
  const [defective, setDefective] = useState('0');
  const [quality, setQuality] = useState('');
  const [expiry, setExpiry] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!produced || Number(produced) <= 0) { setError('Quantité produite > 0'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/production/orders/${orderId}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityProduced: Number(produced),
          quantityDefective: Number(defective) || 0,
          qualityScore: quality ? Number(quality) : undefined,
          expiryDate: expiry || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur');
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Créer un lot de production" onClose={onClose}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        Le lot sera crédité dans l'entrepôt de destination. Reste à produire : <strong>{fmt(remaining)}</strong>.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Produite*</span>
          <input type="number" min="0" step="0.001" className={INP} value={produced} onChange={(e) => setProduced(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Dont défectueuse</span>
          <input type="number" min="0" step="0.001" className={INP} value={defective} onChange={(e) => setDefective(e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Score qualité (0-100)</span>
          <input type="number" min="0" max="100" step="0.1" className={INP} value={quality} onChange={(e) => setQuality(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">DLC</span>
          <input type="date" className={INP} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Notes</span>
        <textarea className={INP + ' h-auto py-2'} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="flex-1 h-11">Annuler</Button>
        <Button onClick={submit} disabled={busy} className="flex-1 h-11 bg-green-600 hover:bg-green-700">
          <Save className="w-4 h-4 mr-1" /> {busy ? 'Création…' : 'Créer le lot'}
        </Button>
      </div>
    </Modal>
  );
}

function CancelModal({ reason, setReason, onCancel, onConfirm }: {
  reason: string;
  setReason: (r: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Annuler l'ordre de production" onClose={onCancel}>
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Motif (optionnel)</span>
        <textarea className={INP + ' h-auto py-2'} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-11">Retour</Button>
        <Button onClick={onConfirm} className="flex-1 h-11 bg-red-600 hover:bg-red-700">
          Confirmer l'annulation
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
