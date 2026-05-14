'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X, Loader2, Banknote, Smartphone, CreditCard, Clock, Check, Wallet, FileText, Building2 } from 'lucide-react';

interface Wallet {
  id?: string;            // mapper varie selon l'origine
  Id?: string;
  WalletId?: string;
  Name?: string; name?: string;
  Type?: string; type?: string;
}

// Le mode "crédit" est traité comme un cas à part : ce n'est pas un moyen
// de paiement (pas de wallet, pas de payment_method_id) mais le marqueur
// d'une vente à crédit (montant payé < total). Il est toujours présent.
export type PosPaymentMethod = string; // code dynamique issu de la DB, ou 'credit'

interface ApiPaymentMethod {
  PaymentMethodId: string;
  Code: string;
  Label: string;
  RequiredWalletType?: string | null;
  DisplayOrder: number;
  Icon?: string | null;
  IsActive: boolean;
}

export interface CheckoutResult {
  paymentMethod: PosPaymentMethod;
  walletId: string | null;
  amountPaid: number;       // montant encaissé maintenant (peut être < total → crédit)
}

// Mapping icône lucide pour les valeurs seedées (et fallback).
const ICON_MAP: Record<string, any> = {
  Banknote, Smartphone, CreditCard, Building2, FileText, Wallet, Clock,
};
function iconFor(name?: string | null) {
  return (name && ICON_MAP[name]) || Wallet;
}

// Couleur arbitraire par code (cohérence visuelle avec l'ancien design).
const COLOR_BY_CODE: Record<string, string> = {
  cash: 'emerald',
  mobile_money: 'orange',
  card: 'blue',
  bank_transfer: 'indigo',
  check: 'slate',
  other: 'gray',
};
function colorFor(code: string) {
  return COLOR_BY_CODE[code] || 'gray';
}

const CREDIT_METHOD = {
  id: 'credit' as const,
  label: 'Crédit',
  icon: Clock,
  walletType: null as string | null,
  color: 'amber',
};

export function CheckoutModal({ total, onClose, onConfirm }: {
  total: number;
  onClose: () => void;
  onConfirm: (r: CheckoutResult) => Promise<void>;
}) {
  const [method, setMethod] = useState<PosPaymentMethod>('cash');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ApiPaymentMethod[]>([]);
  const [walletId, setWalletId] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>(String(total));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wallets actifs + méthodes de paiement actives (dynamiques depuis la DB).
    fetch('/api/treasury/wallets?isActive=true')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setWallets(d.data || []));
    fetch('/api/treasury/payment-methods?isActive=true')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setPaymentMethods((d.data || []) as ApiPaymentMethod[]));
  }, []);

  // Méthodes affichées : celles actives en DB + crédit (cas à part)
  const displayedMethods = useMemo(() => {
    const dynamic = paymentMethods
      .slice()
      .sort((a, b) => a.DisplayOrder - b.DisplayOrder)
      .map(pm => ({
        id: pm.Code,
        label: pm.Label,
        icon: iconFor(pm.Icon),
        walletType: pm.RequiredWalletType || null,
        color: colorFor(pm.Code),
      }));
    return [...dynamic, CREDIT_METHOD];
  }, [paymentMethods]);

  // S'assure que la méthode sélectionnée existe encore (fallback sur la première)
  useEffect(() => {
    if (displayedMethods.length === 0) return;
    if (!displayedMethods.find(m => m.id === method)) {
      setMethod(displayedMethods[0].id);
    }
  }, [displayedMethods, method]);

  // Quand on change de méthode, on resélectionne le 1er wallet disponible
  useEffect(() => {
    const current = displayedMethods.find(m => m.id === method);
    const required = current?.walletType ?? null;
    if (!required) { setWalletId(''); }
    else {
      const candidates = wallets.filter(w => (w.Type || w.type) === required);
      setWalletId(candidates[0] ? (candidates[0].Id || candidates[0].id || '') : '');
    }
    if (method === 'credit') setAmountPaid('0');
    else setAmountPaid(String(total));
  }, [method, wallets, total, displayedMethods]);

  const requiredType = displayedMethods.find(m => m.id === method)?.walletType ?? null;
  const filteredWallets = useMemo(
    () => requiredType ? wallets.filter(w => (w.Type || w.type) === requiredType) : [],
    [wallets, requiredType]
  );

  const paid = Number(amountPaid) || 0;
  const remaining = Math.max(0, total - paid);
  const overpaid = paid > total;

  async function submit() {
    setError(null);
    if (overpaid) { setError('Le montant payé ne peut pas dépasser le total'); return; }
    if (paid < 0) { setError('Montant invalide'); return; }
    if (requiredType && !walletId) { setError(`Choisissez un wallet ${requiredType}`); return; }
    if (method === 'credit' && paid >= total) { setError('Pour un crédit, le montant payé doit être inférieur au total'); return; }
    if (method !== 'credit' && paid <= 0) { setError('Saisissez un montant payé'); return; }

    setSubmitting(true);
    try {
      await onConfirm({
        paymentMethod: method,
        walletId: walletId || null,
        amountPaid: paid,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Encaissement</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-center">
          <div className="text-xs uppercase text-gray-500">Total à encaisser</div>
          <div className="text-3xl font-bold">{total.toLocaleString('fr-FR')} XOF</div>
        </div>

        {/* Méthodes */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {displayedMethods.map(m => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button key={m.id} onClick={() => setMethod(m.id)}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition ${
                  active ? `border-${m.color}-500 bg-${m.color}-50 text-${m.color}-800` : 'border-gray-200 hover:border-gray-400'
                }`}>
                <Icon className="w-6 h-6" />
                <span className="text-sm font-semibold">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sélecteur wallet si nécessaire */}
        {requiredType && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              {method === 'cash' ? 'Caisse' : method === 'mobile_money' ? 'Compte Mobile Money' : 'Compte bancaire / TPE'}
            </label>
            {filteredWallets.length === 0 ? (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                Aucun wallet de type <strong>{requiredType}</strong> n'est configuré.
                <a href="/treasury/wallets/new" className="underline ml-1">En créer un</a>
              </div>
            ) : (
              <select value={walletId} onChange={e => setWalletId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md">
                {filteredWallets.map(w => (
                  <option key={w.Id || w.id} value={w.Id || w.id}>{w.Name || w.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Montant */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 mb-1 block">
            Montant encaissé maintenant {method === 'credit' && '(0 = vente totalement à crédit)'}
          </label>
          <input type="number" min={0} max={total} value={amountPaid}
            onChange={e => setAmountPaid(e.target.value)}
            disabled={method !== 'credit'}
            className="w-full px-3 py-2 border rounded-md text-right text-xl font-bold disabled:bg-gray-50" />
          {method !== 'credit' && (
            <p className="text-xs text-gray-500 mt-1">
              Pour un paiement partiel (crédit), choisissez « Crédit » ci-dessus.
            </p>
          )}
        </div>

        {/* Récap */}
        {(method === 'credit' || paid < total) && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4 text-sm">
            <p className="font-semibold text-amber-900">Reste dû : {remaining.toLocaleString('fr-FR')} XOF</p>
            <p className="text-xs text-amber-800 mt-1">
              La vente sera marquée <strong>partiellement payée</strong> et apparaîtra dans le journal de recouvrement.
            </p>
          </div>
        )}

        {error && <div className="mb-3 px-3 py-2 bg-red-50 text-red-800 rounded text-sm">{error}</div>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Encaissement…</> : <><Check className="w-4 h-4 mr-1" />Confirmer</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
