'use client';

/**
 * Journal de recouvrement
 * Liste des ventes avec balance > 0, avec possibilité d'enregistrer un paiement complémentaire.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Loader2, X, Banknote, Smartphone, CreditCard } from 'lucide-react';

interface OutstandingSale {
  id: string;
  sale_number: string;
  sale_date: string;
  client_name: string | null;
  total_amount: number;
  amount_paid: number;
  balance: number;
  payment_status: string;
  outlet_name: string | null;
  sales_person_name: string | null;
  days_old: number;
}

interface Wallet { id?: string; Id?: string; Name?: string; name?: string; Type?: string; type?: string }

const METHODS = [
  { id: 'cash',         label: 'Espèces',      icon: Banknote,    walletType: 'cash' },
  { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone,  walletType: 'mobile_money' },
  { id: 'card',         label: 'TPE',          icon: CreditCard,  walletType: 'bank' },
];

export default function RecouvrementPage() {
  const [sales, setSales] = useState<OutstandingSale[]>([]);
  const [totals, setTotals] = useState<{ count: number; totalDue: number; totalAmount: number; totalPaid: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'old'>('all');
  const [selected, setSelected] = useState<OutstandingSale | null>(null);

  useEffect(() => { void load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const url = filter === 'old' ? '/api/sales/outstanding?olderThanDays=15' : '/api/sales/outstanding';
      const r = await fetch(url);
      if (r.ok) {
        const { data } = await r.json();
        setSales(data.sales || []);
        setTotals(data.totals);
      }
    } finally { setLoading(false); }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.SALES_VIEW}>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Link href="/sales" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour aux ventes
        </Link>

        <div className="flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-amber-600" />
          <h1 className="text-3xl font-bold">Recouvrement</h1>
        </div>

        <p className="text-sm text-gray-600">
          Ventes avec un solde restant à encaisser. Cliquez une ligne pour enregistrer un paiement complémentaire.
        </p>

        {/* KPIs */}
        {totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Ventes en recouvrement" value={String(totals.count)} color="amber" />
            <KPI label="Total dû" value={`${totals.totalDue.toLocaleString('fr-FR')} XOF`} color="red" />
            <KPI label="Total facturé" value={`${totals.totalAmount.toLocaleString('fr-FR')} XOF`} color="gray" />
            <KPI label="Déjà encaissé" value={`${totals.totalPaid.toLocaleString('fr-FR')} XOF`} color="emerald" />
          </div>
        )}

        {/* Filtres */}
        <div className="flex gap-2">
          <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
            Toutes
          </Button>
          <Button variant={filter === 'old' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('old')}>
            Plus de 15 jours
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : sales.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border text-center">
            <p className="text-emerald-700 text-lg font-semibold">Aucune vente à recouvrer 🎉</p>
            <p className="text-sm text-gray-500 mt-1">Toutes les ventes sont entièrement payées.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2">N° vente</th>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Client</th>
                  <th className="text-left px-3 py-2">Outlet</th>
                  <th className="text-left px-3 py-2">Commercial</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Payé</th>
                  <th className="text-right px-3 py-2">Reste dû</th>
                  <th className="text-center px-3 py-2">Âge</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.map(s => (
                  <tr key={s.id} onClick={() => setSelected(s)} className="hover:bg-amber-50 cursor-pointer">
                    <td className="px-3 py-2 font-mono text-xs">{s.sale_number}</td>
                    <td className="px-3 py-2">{new Date(s.sale_date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2">{s.client_name || <span className="text-gray-400 italic">anonyme</span>}</td>
                    <td className="px-3 py-2 text-xs">{s.outlet_name || '—'}</td>
                    <td className="px-3 py-2 text-xs">{s.sales_person_name || '—'}</td>
                    <td className="px-3 py-2 text-right">{s.total_amount.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{s.amount_paid.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2 text-right font-bold text-red-700">{s.balance.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${s.days_old > 30 ? 'bg-red-100 text-red-700' : s.days_old > 15 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                        {s.days_old} j
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selected && (
          <PaymentModal sale={selected} onClose={() => setSelected(null)} onPaid={() => { setSelected(null); void load(); }} />
        )}
      </div>
    </ProtectedPage>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  const palette: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red:   'border-red-200 bg-red-50 text-red-800',
    gray:  'border-gray-200 bg-gray-50 text-gray-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return (
    <div className={`p-3 rounded-xl border-2 ${palette[color]}`}>
      <div className="text-xs uppercase font-semibold">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

function PaymentModal({ sale, onClose, onPaid }: {
  sale: OutstandingSale; onClose: () => void; onPaid: () => void;
}) {
  const [method, setMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState(String(sale.balance));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/treasury/wallets?isActive=true').then(r => r.json()).then(d => setWallets(d.data || []));
  }, []);

  const requiredType = METHODS.find(m => m.id === method)?.walletType;
  const filtered = wallets.filter(w => (w.Type || w.type) === requiredType);

  useEffect(() => {
    setWalletId(filtered[0] ? (filtered[0].Id || filtered[0].id || '') : '');
  }, [method, wallets]);

  async function submit() {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError('Montant invalide'); return; }
    if (amt > sale.balance) { setError(`Le montant dépasse le solde dû (${sale.balance})`); return; }
    if (!walletId) { setError('Choisissez un wallet'); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/sales/${sale.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          paymentMethod: method,
          walletId,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      onPaid();
    } catch (e: any) {
      setError(e.message);
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Encaisser un paiement</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
          <p><strong>Vente :</strong> {sale.sale_number} · {sale.client_name || 'anonyme'}</p>
          <p className="mt-1">Total : <strong>{sale.total_amount.toLocaleString('fr-FR')} XOF</strong> · Reste dû : <strong className="text-red-700">{sale.balance.toLocaleString('fr-FR')} XOF</strong></p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {METHODS.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => setMethod(m.id as any)}
                className={`p-3 rounded border-2 flex flex-col items-center gap-1 ${method === m.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200'}`}>
                <Icon className="w-5 h-5" />
                <span className="text-xs">{m.label}</span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800 mb-3">
            Aucun wallet de type <strong>{requiredType}</strong>. <a href="/treasury/wallets/new" className="underline">En créer</a>.
          </div>
        ) : (
          <select value={walletId} onChange={e => setWalletId(e.target.value)}
            className="w-full px-3 py-2 border rounded mb-3">
            {filtered.map(w => <option key={w.Id || w.id} value={w.Id || w.id}>{w.Name || w.name}</option>)}
          </select>
        )}

        <input type="number" min={1} max={sale.balance} value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full px-3 py-2 border rounded text-right text-xl font-bold mb-3"
          placeholder="Montant" />

        {error && <div className="mb-3 px-3 py-2 bg-red-50 text-red-800 rounded text-sm">{error}</div>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={submitting || filtered.length === 0}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />…</> : 'Encaisser'}
          </Button>
        </div>
      </div>
    </div>
  );
}
