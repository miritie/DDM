'use client';

/**
 * Détail commande client négociée — timeline + actions par statut.
 */

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Loader2, CheckCircle, XCircle, Truck, Factory, Package,
  CreditCard, Banknote, Smartphone, Clock,
} from 'lucide-react';

const FLOW = ['draft', 'submitted', 'approved', 'in_production', 'produced', 'transferred', 'delivered', 'completed'];
const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', submitted: 'Soumise', approved: 'Approuvée admin',
  in_production: 'En production', produced: 'Produite', transferred: 'Transférée',
  delivered: 'Livrée', completed: 'Soldée & terminée', cancelled: 'Annulée',
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/customer-orders/${id}`).then(r => r.json()).then(d => setOrder(d.data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [id]);

  async function callTransition(action: string, body: any = {}) {
    if (!confirm(`Confirmer l'action : ${action} ?`)) return;
    setBusy(action);
    try {
      const r = await fetch(`/api/customer-orders/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
      load();
    } catch (e: any) { alert(`❌ ${e.message}`); }
    finally { setBusy(null); }
  }

  async function approve() {
    if (!confirm('Approuver cette commande ?\n\nLa production pourra ensuite être lancée.')) return;
    setBusy('approve');
    try {
      const r = await fetch(`/api/customer-orders/${id}/approve`, { method: 'POST' });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
      load();
    } catch (e: any) { alert(`❌ ${e.message}`); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
  if (!order) return <div className="p-6 text-red-600">Commande introuvable</div>;

  const stepIdx = FLOW.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_VIEW}>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Link href="/orders" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour aux commandes
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">{order.order_number}</h1>
            <p className="text-sm text-gray-600">
              Client : <strong>{order.client_full_name || order.client_name || '—'}</strong>
              {order.client_phone && ` · ${order.client_phone}`}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Saisi le {new Date(order.created_at).toLocaleString('fr-FR')} par {order.requested_by_name || '—'}
              {order.approved_by_name && ` · approuvé par ${order.approved_by_name}`}
            </p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${isCancelled ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>

        {/* Timeline */}
        {!isCancelled && (
          <div className="bg-white p-4 rounded-2xl border">
            <div className="flex items-center justify-between">
              {FLOW.map((s, i) => {
                const done = i <= stepIdx;
                const current = i === stepIdx;
                return (
                  <div key={s} className="flex-1 text-center">
                    <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      done ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                    } ${current ? 'ring-4 ring-blue-200' : ''}`}>{i + 1}</div>
                    <div className={`text-[10px] mt-1 ${done ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>
                      {STATUS_LABELS[s]}
                    </div>
                    {i < FLOW.length - 1 && (
                      <div className={`hidden md:block h-0.5 -mt-4 mx-auto ${done && i < stepIdx ? 'bg-blue-400' : 'bg-gray-200'}`} style={{ width: '60%' }}></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Montants */}
        <div className="grid grid-cols-3 gap-3">
          <Money label="Total négocié" value={order.total_amount} color="gray" />
          <Money label="Encaissé" value={order.amount_paid} color="emerald" />
          <Money label="Solde dû" value={order.balance} color="orange" highlight />
        </div>

        {/* Actions selon statut */}
        {!isCancelled && order.status !== 'completed' && (
          <div className="bg-white p-4 rounded-2xl border">
            <h3 className="font-bold mb-3">Actions disponibles</h3>
            <div className="flex gap-2 flex-wrap">
              {order.status === 'draft' && (
                <Button onClick={approve} disabled={busy !== null}>
                  <CheckCircle className="w-4 h-4 mr-1" /> Approuver (admin)
                </Button>
              )}
              {order.status === 'in_production' && (
                <Button onClick={() => callTransition('mark_produced')} disabled={busy !== null}>
                  <Factory className="w-4 h-4 mr-1" /> Marquer produite
                </Button>
              )}
              {order.status === 'produced' && (
                <Button onClick={() => callTransition('mark_transferred')} disabled={busy !== null}>
                  <Truck className="w-4 h-4 mr-1" /> Marquer transférée
                </Button>
              )}
              {order.status === 'transferred' && (
                <Button onClick={() => callTransition('mark_delivered')} disabled={busy !== null}>
                  <Package className="w-4 h-4 mr-1" /> Marquer livrée
                </Button>
              )}
              {order.balance > 0 && order.status !== 'draft' && (
                <PayButton orderId={id} balance={Number(order.balance)} onPaid={load} />
              )}
              {order.status === 'delivered' && Number(order.balance) === 0 && (
                <FinalizeButton orderId={id} onDone={load} />
              )}
              <Button variant="outline" onClick={() => callTransition('cancel', { reason: prompt('Raison ?') || '' })} disabled={busy !== null}>
                <XCircle className="w-4 h-4 mr-1" /> Annuler
              </Button>
            </div>
            {order.status === 'approved' && (
              <p className="text-xs text-gray-500 mt-2">
                ℹ️ Pour démarrer la production : créez un ordre de production lié depuis <Link href="/production/orders/new" className="text-blue-600 underline">/production/orders/new</Link>,
                puis revenez lier l'ordre via la page production.
              </p>
            )}
          </div>
        )}

        {/* Lignes */}
        <div className="bg-white p-5 rounded-2xl border">
          <h3 className="font-bold mb-3">Produits commandés</h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Produit</th>
                <th className="text-right px-3 py-2">Qté</th>
                <th className="text-right px-3 py-2">Prix nego</th>
                <th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(order.lines || []).map((l: any) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.product_name}</div>
                    <div className="text-xs text-gray-500 font-mono">{l.product_code}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{l.quantity}</td>
                  <td className="px-3 py-2 text-right">{Number(l.unit_price).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2 text-right font-bold">{Number(l.line_total).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paiements */}
        <div className="bg-white p-5 rounded-2xl border">
          <h3 className="font-bold mb-3">Historique des paiements</h3>
          {(order.payments || []).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Aucun paiement encore</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Mode</th>
                  <th className="text-left px-3 py-2">Wallet</th>
                  <th className="text-right px-3 py-2">Montant</th>
                  <th className="text-left px-3 py-2">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.payments.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-xs">{new Date(p.payment_date).toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2">{p.payment_method}</td>
                    <td className="px-3 py-2 text-xs">{p.wallet_name || '—'}</td>
                    <td className="px-3 py-2 text-right font-bold">{Number(p.amount).toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2 text-xs">{p.is_advance ? 'Avance' : 'Paiement'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Liens */}
        {(order.production_order_number || order.sale_number_linked) && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm">
            <strong>Liaisons :</strong>
            {order.production_order_number && (
              <span className="ml-2">
                Production : <Link href="/production/orders" className="underline">{order.production_order_number}</Link>
              </span>
            )}
            {order.sale_number_linked && (
              <span className="ml-2">
                Vente : <Link href="/sales" className="underline">{order.sale_number_linked}</Link>
              </span>
            )}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}

function Money({ label, value, color, highlight }: { label: string; value: string | number; color: string; highlight?: boolean }) {
  const palette: Record<string, string> = {
    gray: 'border-gray-200 bg-gray-50 text-gray-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    orange: 'border-orange-300 bg-orange-50 text-orange-900',
  };
  return (
    <div className={`p-3 rounded-xl border-2 ${palette[color]} ${highlight ? 'shadow-md' : ''}`}>
      <div className="text-xs uppercase font-semibold">{label}</div>
      <div className="text-xl font-bold mt-0.5">{Number(value).toLocaleString('fr-FR')} XOF</div>
    </div>
  );
}

function PayButton({ orderId, balance, onPaid }: { orderId: string; balance: number; onPaid: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState('cash');
  const [walletId, setWalletId] = useState('');
  const [wallets, setWallets] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) fetch('/api/treasury/wallets?isActive=true').then(r => r.json()).then(d => setWallets(d.data || [])); }, [open]);
  const reqType = method === 'cash' ? 'cash' : method === 'mobile_money' ? 'mobile_money' : 'bank';
  const filtered = wallets.filter(w => (w.Type || w.type) === reqType);

  async function submit() {
    if (amount <= 0 || amount > balance) { setError(`Montant entre 1 et ${balance}`); return; }
    if (filtered.length > 0 && !walletId) { setError('Sélectionnez un wallet'); return; }
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/customer-orders/${orderId}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentMethod: method, walletId: walletId || undefined }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
      setOpen(false); onPaid();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><Banknote className="w-4 h-4 mr-1" /> Encaisser un paiement</Button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-3">Encaisser un paiement</h3>
            <p className="text-sm text-gray-600 mb-3">Solde dû : <strong>{balance.toLocaleString('fr-FR')} XOF</strong></p>
            <div className="space-y-3">
              <select value={method} onChange={e => setMethod(e.target.value)} className="w-full px-3 py-2 border rounded">
                <option value="cash">Espèces</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">TPE / Carte</option>
              </select>
              {filtered.length > 0 ? (
                <select value={walletId} onChange={e => setWalletId(e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option value="">— Wallet —</option>
                  {filtered.map((w: any) => <option key={w.Id || w.id} value={w.Id || w.id}>{w.Name || w.name}</option>)}
                </select>
              ) : (
                <p className="text-sm text-amber-700">Aucun wallet de ce type. <a href="/treasury/wallets/new" className="underline">En créer</a></p>
              )}
              <input type="number" min={1} max={balance} value={amount} onChange={e => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded text-right text-xl font-bold" />
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={submit} disabled={busy}>{busy ? '…' : 'Encaisser'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FinalizeButton({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletId, setOutletId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) fetch('/api/outlets?isActive=true').then(r => r.json()).then(d => setOutlets(d.data || [])); }, [open]);

  async function submit() {
    if (!outletId) { alert('Sélectionnez un outlet'); return; }
    if (!confirm('Finaliser : générer la vente liée et marquer la commande comme soldée ?')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/customer-orders/${orderId}/finalize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outletId }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || `HTTP ${r.status}`);
      setOpen(false); onDone();
    } catch (e: any) { alert(`❌ ${e.message}`); } finally { setBusy(false); }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><CheckCircle className="w-4 h-4 mr-1" /> Finaliser (générer vente)</Button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-3">Finaliser la commande</h3>
            <p className="text-sm text-gray-600 mb-3">Sur quel outlet rattacher la vente générée ?</p>
            <select value={outletId} onChange={e => setOutletId(e.target.value)} className="w-full px-3 py-2 border rounded mb-3">
              <option value="">— Outlet —</option>
              {outlets.map((o: any) => <option key={o.id} value={o.id}>{o.Name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={submit} disabled={busy}>{busy ? '…' : 'Finaliser'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
