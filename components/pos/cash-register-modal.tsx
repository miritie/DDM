'use client';

/**
 * Modal — Vue de la caisse stand (solde + dépôts récents + bouton dépôt).
 *
 * Accessible via l'icône 💰 Caisse du bandeau header POS.
 *
 * Affiche :
 *   - le solde courant du wallet caisse associé au stand
 *   - un gros bouton « Déposer en caisse… » qui ouvre CashDepositModal
 *   - la liste des 20 derniers dépôts du stand avec leur statut
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, X, Wallet, RefreshCw, Banknote, Building2, Smartphone, User as UserIcon, Check, AlertTriangle, Clock } from 'lucide-react';
import { CashDepositModal } from './cash-deposit-modal';

interface CashRegisterModalProps {
  outletId: string;
  outletName: string;
  onClose: () => void;
}

interface Deposit {
  id: string;
  DepositId: string;
  DestinationType: 'bank' | 'mobile_money' | 'person';
  DestinationWalletName: string | null;
  DestinationLabel: string | null;
  Amount: number;
  Status: 'pending' | 'validated' | 'rejected';
  Reference: string | null;
  DepositedAt: string;
  DepositedByName?: string;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XOF';

export function CashRegisterModal({ outletId, outletName, onClose }: CashRegisterModalProps) {
  const [wallet, setWallet] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balRes, depRes] = await Promise.allSettled([
        fetch(`/api/outlets/${encodeURIComponent(outletId)}/cash-balance`),
        fetch(`/api/cash-deposits?outletId=${encodeURIComponent(outletId)}&limit=20`),
      ]);
      if (balRes.status === 'fulfilled' && balRes.value.ok) {
        const { data } = await balRes.value.json();
        setWallet(data?.wallet ?? null);
      } else {
        setError('Impossible de charger le solde caisse.');
      }
      if (depRes.status === 'fulfilled' && depRes.value.ok) {
        const { data } = await depRes.value.json();
        setDeposits(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold">Ma caisse — {outletName}</h2>
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

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {loading && !wallet ? (
            <div className="text-center py-10"><Loader2 className="w-6 h-6 mx-auto animate-spin text-emerald-600" /></div>
          ) : error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          ) : !wallet ? (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Aucun wallet caisse trouvé pour ce stand. Demande au comptable d'en créer un dans <strong>/treasury/wallets/new</strong> (type Cash, idéalement nommé « Caisse {outletName} »).
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
                <p className="text-[11px] uppercase font-semibold text-emerald-700 tracking-wide">Solde caisse</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">{fmt(wallet.balance)}</p>
                <p className="text-xs text-emerald-700 mt-1 truncate">{wallet.name}</p>
              </div>

              <button
                onClick={() => setShowDeposit(true)}
                disabled={wallet.balance <= 0}
                className="w-full py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:bg-gray-400 inline-flex items-center justify-center gap-2"
              >
                <Banknote className="w-5 h-5" />
                Déposer en caisse…
              </button>

              <div className="pt-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Dépôts récents ({deposits.length})
                </h3>
                {deposits.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-4">Aucun dépôt enregistré</p>
                ) : (
                  <div className="space-y-1">
                    {deposits.map(d => <DepositRow key={d.id} deposit={d} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showDeposit && wallet && (
        <CashDepositModal
          outletId={outletId}
          outletName={outletName}
          cashWalletId={wallet.id}
          cashWalletName={wallet.name}
          cashWalletBalance={wallet.balance}
          onClose={() => setShowDeposit(false)}
          onCreated={() => { setShowDeposit(false); void load(); }}
        />
      )}
    </div>
  );
}

function DepositRow({ deposit }: { deposit: Deposit }) {
  const DestIcon = deposit.DestinationType === 'bank' ? Building2
    : deposit.DestinationType === 'mobile_money' ? Smartphone
    : UserIcon;
  const destLabel = deposit.DestinationWalletName ?? deposit.DestinationLabel ?? '—';

  const statusConfig = {
    pending:   { Icon: Clock,          color: 'bg-amber-100 text-amber-800',    label: 'En attente' },
    validated: { Icon: Check,          color: 'bg-emerald-100 text-emerald-800', label: 'Validé' },
    rejected:  { Icon: AlertTriangle,  color: 'bg-red-100 text-red-700',         label: 'Rejeté' },
  }[deposit.Status];

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white">
      <DestIcon className="w-4 h-4 text-gray-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{destLabel}</p>
        <p className="text-[11px] text-gray-500">
          {new Date(deposit.DepositedAt).toLocaleDateString('fr-FR')} · {deposit.DepositedByName ?? '—'}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">{fmt(deposit.Amount)}</p>
        <span className={'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ' + statusConfig.color}>
          <statusConfig.Icon className="w-2.5 h-2.5" />
          {statusConfig.label}
        </span>
      </div>
    </div>
  );
}
