'use client';

/**
 * Détail d'un approvisionnement stand.
 * - Workflow : draft → submitted → approved → in_production → produced → distributed
 * - Tableau de suivi : pour chaque ligne, pour chaque stand cible : reçu/total + bouton "Distribuer"
 * - Distribution : un modal pour saisir qty + entrepôt source. Plusieurs livraisons partielles autorisées.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Loader2, AlertTriangle, Truck, CheckCircle, XCircle,
  Factory, Package, Send, Link2,
} from 'lucide-react';

const STATUS_FLOW = ['draft', 'submitted', 'approved', 'in_production', 'produced', 'distributed'];
const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'Soumise', approved: 'Approuvée',
  in_production: 'En production', produced: 'Produite',
  distributed: 'Distribuée', cancelled: 'Annulée',
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' F';
}

export default function ReplenishmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Distribution modal
  const [distTarget, setDistTarget] = useState<any | null>(null);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [distQty, setDistQty] = useState(0);
  const [distWarehouseId, setDistWarehouseId] = useState('');
  const [distNotes, setDistNotes] = useState('');
  const [distError, setDistError] = useState<string | null>(null);

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    fetch('/api/stock/warehouses?isActive=true')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setWarehouses((d.data || []).map((w: any) => ({
        id: w.Id || w.id, name: w.Name || w.name,
      }))));
  }, []);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`/api/replenishments/${id}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Erreur ${r.status}`);
      }
      const j = await r.json();
      setOrder(j.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function callTransition(action: string, extra: any = {}) {
    if (action === 'cancel') {
      const reason = prompt('Raison de l\'annulation ?');
      if (reason === null) return;
      extra.reason = reason;
    } else if (!confirm(`Confirmer : ${action} ?`)) return;
    setBusy(action);
    try {
      const r = await fetch(`/api/replenishments/${id}/transition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      await load();
    } catch (e: any) { alert(`❌ ${e.message}`); }
    finally { setBusy(null); }
  }

  function openDistribute(target: any) {
    const remaining = Number(target.quantity_target) - Number(target.quantity_received);
    setDistTarget(target);
    setDistQty(remaining);
    setDistError(null);
    setDistNotes('');
    if (warehouses.length > 0) setDistWarehouseId(warehouses[0].id);
  }

  async function submitDistribute() {
    if (!distTarget) return;
    setDistError(null);
    if (distQty <= 0) { setDistError('Quantité invalide'); return; }
    if (!distWarehouseId) { setDistError('Sélectionner l\'entrepôt source'); return; }
    setBusy('distribute');
    try {
      const r = await fetch(`/api/replenishments/${id}/distribute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: distTarget.id,
          quantity: distQty,
          sourceWarehouseId: distWarehouseId,
          notes: distNotes || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setDistTarget(null);
      await load();
    } catch (e: any) { setDistError(e.message); }
    finally { setBusy(null); }
  }

  if (loading) {
    return (
      <ProtectedPage permission={PERMISSIONS.REPLENISHMENT_VIEW}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      </ProtectedPage>
    );
  }
  if (error || !order) {
    return (
      <ProtectedPage permission={PERMISSIONS.REPLENISHMENT_VIEW}>
        <div className="p-8 max-w-2xl mx-auto text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-orange-500 mb-3" />
          <p className="text-gray-700 mb-4">{error || 'Approvisionnement introuvable'}</p>
          <Button variant="outline" onClick={() => router.push('/replenishments')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
        </div>
      </ProtectedPage>
    );
  }

  const stepIdx = STATUS_FLOW.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const allTargets = (order.lines || []).flatMap((l: any) => l.targets || []);
  const totalTarget = allTargets.reduce((s: number, t: any) => s + Number(t.quantity_target), 0);
  const totalReceived = allTargets.reduce((s: number, t: any) => s + Number(t.quantity_received), 0);
  const progress = totalTarget > 0 ? Math.round((totalReceived / totalTarget) * 100) : 0;

  return (
    <ProtectedPage permission={PERMISSIONS.REPLENISHMENT_VIEW}>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/replenishments" className="hover:text-blue-600">Approvisionnements</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">{order.replenishment_number}</span>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Truck className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-wider opacity-90">Approvisionnement stand</p>
                <h1 className="text-2xl md:text-3xl font-bold font-mono">{order.replenishment_number}</h1>
                <p className="text-sm opacity-90">Demandé par {order.requested_by_name || '—'} · Valeur estimée {formatCurrency(Number(order.total_value_estimate))}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline statut */}
        {!isCancelled && (
          <div className="bg-white p-5 rounded-2xl border">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              {STATUS_FLOW.map((s, i) => {
                const done = i <= stepIdx;
                const current = i === stepIdx;
                return (
                  <div key={s} className="flex-1 text-center min-w-[80px]">
                    <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-400'
                    } ${current ? 'ring-4 ring-violet-200' : ''}`}>{i + 1}</div>
                    <div className={`text-[10px] mt-1 ${done ? 'text-violet-700 font-semibold' : 'text-gray-400'}`}>
                      {STATUS_LABELS[s]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm">
            ❌ Cette demande a été annulée.
          </div>
        )}

        {/* Progression */}
        <div className="bg-white p-5 rounded-2xl border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold">Avancement global de la distribution</h3>
            <span className="text-2xl font-bold text-emerald-600">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {totalReceived} / {totalTarget} unités livrées au total
          </p>
        </div>

        {/* Actions */}
        {!isCancelled && order.status !== 'distributed' && (
          <div className="bg-white p-4 rounded-2xl border">
            <h3 className="font-bold mb-3">Actions disponibles</h3>
            <div className="flex gap-2 flex-wrap">
              {order.status === 'draft' && (
                <Can permission={PERMISSIONS.REPLENISHMENT_CREATE}>
                  <Button onClick={() => callTransition('submit')} disabled={busy !== null}>
                    <Send className="w-4 h-4 mr-1" /> Soumettre à validation
                  </Button>
                </Can>
              )}
              {order.status === 'submitted' && (
                <Can permission={PERMISSIONS.REPLENISHMENT_APPROVE}>
                  <Button onClick={() => callTransition('approve')} disabled={busy !== null}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Approuver (admin)
                  </Button>
                </Can>
              )}
              {(order.status === 'approved' || order.status === 'in_production') && (
                <Can permission={PERMISSIONS.REPLENISHMENT_APPROVE}>
                  <Button variant="outline" onClick={async () => {
                    const productionOrderId = prompt('UUID ou n° du production_order à lier :');
                    if (productionOrderId) callTransition('link_production', { productionOrderId });
                  }} disabled={busy !== null}>
                    <Link2 className="w-4 h-4 mr-1" /> Lier production
                  </Button>
                  <Button onClick={() => callTransition('mark_produced')} disabled={busy !== null}>
                    <Factory className="w-4 h-4 mr-1" /> Marquer produit
                  </Button>
                </Can>
              )}
              <Can permission={PERMISSIONS.REPLENISHMENT_APPROVE}>
                <Button variant="outline" onClick={() => callTransition('cancel')} disabled={busy !== null}
                  className="text-red-700 border-red-300 hover:bg-red-50">
                  <XCircle className="w-4 h-4 mr-1" /> Annuler
                </Button>
              </Can>
            </div>
            {order.production_order_number && (
              <p className="text-sm text-gray-600 mt-3">
                📋 Production liée : <strong className="font-mono">{order.production_order_number}</strong>
              </p>
            )}
            {order.notes && (
              <p className="text-sm text-gray-600 mt-3 whitespace-pre-line border-t pt-2">
                <strong>Notes :</strong> {order.notes}
              </p>
            )}
          </div>
        )}

        {/* Tableau de suivi : produit × stand */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold flex items-center gap-2"><Package className="w-5 h-5" /> Suivi détaillé par stand</h3>
          </div>
          {(order.lines || []).length === 0 ? (
            <div className="p-8 text-center text-gray-500">Aucune ligne</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Produit</th>
                    <th className="px-4 py-3 text-left">Stand cible</th>
                    <th className="px-4 py-3 text-right">Demandé</th>
                    <th className="px-4 py-3 text-right">Reçu</th>
                    <th className="px-4 py-3 text-right">Reste</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(order.lines || []).flatMap((l: any) =>
                    (l.targets || []).map((t: any) => {
                      const target = Number(t.quantity_target);
                      const received = Number(t.quantity_received);
                      const remaining = target - received;
                      const pct = target > 0 ? Math.round((received / target) * 100) : 0;
                      const status = received === 0 ? 'attente' : received >= target ? 'complet' : 'partiel';
                      const statusStyles: Record<string, string> = {
                        attente: 'bg-gray-100 text-gray-700',
                        partiel: 'bg-amber-100 text-amber-700',
                        complet: 'bg-emerald-100 text-emerald-700',
                      };
                      return (
                        <tr key={`${l.id}-${t.id}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{l.product_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{l.product_code}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{t.outlet_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{t.outlet_code}</div>
                          </td>
                          <td className="px-4 py-3 text-right">{target.toLocaleString('fr-FR')}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">{received.toLocaleString('fr-FR')}</td>
                          <td className={`px-4 py-3 text-right ${remaining > 0 ? 'text-amber-700 font-semibold' : 'text-gray-500'}`}>
                            {remaining.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyles[status]}`}>
                                {status === 'attente' ? 'En attente' : status === 'partiel' ? `${pct}%` : '✓ Complet'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {remaining > 0 && order.status !== 'cancelled' && order.status !== 'draft' && order.status !== 'submitted' && (
                              <Can permission={PERMISSIONS.REPLENISHMENT_DISTRIBUTE}>
                                <Button size="sm" onClick={() => openDistribute(t)}>
                                  <Truck className="w-3 h-3 mr-1" /> Distribuer
                                </Button>
                              </Can>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-start">
          <Link href="/replenishments">
            <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Retour à la liste</Button>
          </Link>
        </div>

        {/* Modal distribution */}
        {distTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDistTarget(null)}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="font-bold text-lg mb-1">Distribuer vers le stand</h3>
              <p className="text-sm text-gray-600 mb-4">
                <strong>{distTarget.outlet_name}</strong> · Reste à livrer : <strong>{(Number(distTarget.quantity_target) - Number(distTarget.quantity_received)).toLocaleString('fr-FR')}</strong>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Entrepôt source <span className="text-red-500">*</span></label>
                  <select value={distWarehouseId} onChange={(e) => setDistWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border rounded">
                    <option value="">— Sélectionner —</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Quantité à livrer maintenant <span className="text-red-500">*</span></label>
                  <input type="number" min={1} step={1} max={Number(distTarget.quantity_target) - Number(distTarget.quantity_received)}
                    value={distQty} onChange={(e) => setDistQty(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border rounded text-right text-xl font-bold" />
                  <p className="text-xs text-gray-500 mt-1">Les livraisons partielles sont autorisées.</p>
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Notes (optionnel)</label>
                  <input type="text" value={distNotes} onChange={(e) => setDistNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm" placeholder="N° BL, chauffeur, etc." />
                </div>
                {distError && <p className="text-sm text-red-700">❌ {distError}</p>}
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setDistTarget(null)}>Annuler</Button>
                  <Button onClick={submitDistribute} disabled={busy === 'distribute'}>
                    {busy === 'distribute' ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />…</> : 'Confirmer la livraison'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
