'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
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
  Id: string;                  // UUID PK (utilisé pour le filtrage par outlet)
  PaymentMethodId: string;     // business code (PM-…)
  Code: string;                // code métier (cash, mobile_money, …)
  Label: string;
  RequiredWalletType?: string | null;
  DisplayOrder: number;
  Icon?: string | null;
  IsActive: boolean;
}

export interface CheckoutResult {
  paymentMethod: PosPaymentMethod;
  paymentMethodLabel: string;  // « Espèces », « Carte / TPE », etc.
  walletId: string | null;
  walletName?: string | null;
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

export function CheckoutModal({ total, outletId, allowsCredit = false, onClose, onConfirm }: {
  total: number;
  /** Si fourni, le modal filtre les payment_methods sur ceux acceptés par
   *  ce point de vente (config /admin/outlets/[id] → section paiements). */
  outletId?: string;
  /** Si true, l'option « Crédit » (paiement partiel) est proposée.
   *  Désactivé par défaut : un vendeur ne peut pas faire de crédit sans
   *  configuration explicite du manager. */
  allowsCredit?: boolean;
  onClose: () => void;
  onConfirm: (r: CheckoutResult) => Promise<void>;
}) {
  const [method, setMethod] = useState<PosPaymentMethod>('cash');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ApiPaymentMethod[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<Set<string> | null>(null);
  const [walletId, setWalletId] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>(String(total));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wallets actifs + méthodes de paiement actives (dynamiques depuis la DB).
    fetch('/api/treasury/wallets?isActive=true')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setWallets(d.data || []))
      .catch(() => {});
    fetch('/api/treasury/payment-methods?isActive=true')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setPaymentMethods((d.data || []) as ApiPaymentMethod[]))
      .catch(() => {});
    // Liste acceptée par cet outlet (filtrage) — si pas d'outletId, on
    // affiche tout (cas legacy, mais en pratique le POS passe toujours
    // un outletId).
    if (outletId) {
      fetch('/api/outlets/' + encodeURIComponent(outletId) + '/payment-methods')
        .then(r => r.ok ? r.json() : { data: { acceptedIds: [] } })
        .then(d => setAcceptedIds(new Set(d.data?.acceptedIds ?? [])))
        .catch(() => setAcceptedIds(null));
    } else {
      setAcceptedIds(null);
    }
  }, [outletId]);

  // Méthodes affichées : celles actives en DB filtrées par acceptedIds
  // (config outlet). Le « Crédit » n'est ajouté QUE si l'outlet l'autorise
  // explicitement (outlet.allows_credit) — c'est un cas à part qui doit
  // être expressément ouvert par le manager.
  const displayedMethods = useMemo(() => {
    const dynamic = paymentMethods
      .filter(pm => acceptedIds === null || acceptedIds.has(pm.Id))
      .slice()
      .sort((a, b) => a.DisplayOrder - b.DisplayOrder)
      .map(pm => ({
        id: pm.Code,
        label: pm.Label,
        icon: iconFor(pm.Icon),
        walletType: pm.RequiredWalletType || null,
        color: colorFor(pm.Code),
      }));
    return allowsCredit ? [...dynamic, CREDIT_METHOD] : dynamic;
  }, [paymentMethods, acceptedIds, allowsCredit]);

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
      const currentMethod = displayedMethods.find(m => m.id === method);
      const selectedWallet = walletId ? wallets.find(w => (w.Id ?? w.id) === walletId) : null;
      await onConfirm({
        paymentMethod: method,
        paymentMethodLabel: currentMethod?.label ?? method,
        walletId: walletId || null,
        walletName: selectedWallet?.Name ?? selectedWallet?.name ?? null,
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

        {/* Caisse / wallet : auto-pickée (premier wallet actif compatible).
            Le vendeur ne choisit PAS la caisse — c'est celle de sa session
            POS en cours. Si aucun wallet du type requis n'existe, on alerte
            avec un lien vers la création (admin/comptable). */}
        {requiredType && filteredWallets.length === 0 && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            Aucune caisse de type <strong>{requiredType}</strong> n'est configurée pour ce moyen de paiement.
            <Link href="/treasury/wallets/new" className="underline ml-1">En créer une</Link>
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
          {method !== 'credit' && allowsCredit && (
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
          <Button variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
          {/* Confirmer = action positive d'encaissement → emerald (cohérence
              avec la sémantique du module : vert = argent qui rentre). */}
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Encaissement…</> : <><Check className="w-4 h-4" />Confirmer</>}
          </button>
        </div>
      </div>
    </div>
  );
}
