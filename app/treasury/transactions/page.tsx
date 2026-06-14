'use client';

/**
 * Page - Historique des Transactions — mobile-first.
 *
 * Tableau 8 colonnes (scroll horizontal) remplacé par une liste de
 * cartes : type, description, sens (source → destination), montant
 * signé, catégorie, statut, date. Totaux en tête, filtres en pills.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Transaction, Wallet } from '@/types/modules';
import {
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Plus, RefreshCw, ArrowLeft,
} from 'lucide-react';

const fmtCompact = (n: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M F';
  return new Intl.NumberFormat('fr-FR').format(Math.round(v)) + ' F';
};

const CATEGORY_LABELS: Record<string, string> = {
  sale: 'Ventes', sales: 'Ventes', services: 'Services', salary: 'Salaires',
  supplies: 'Fournitures', purchase: 'Achats', rent: 'Loyer', utilities: 'Charges',
  marketing: 'Marketing', transport: 'Transport', maintenance: 'Maintenance',
  transfer: 'Transfert', adjustment: 'Ajustement', debt_payment: 'Dette', advance: 'Avance', other: 'Autre',
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  useEffect(() => { loadData(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    try {
      setLoading(true);
      const walletsRes = await fetch('/api/treasury/wallets?isActive=true');
      if (walletsRes.ok) setWallets((await walletsRes.json()).data || []);
      const params = filter !== 'all' ? `?type=${filter}` : '';
      const transactionsRes = await fetch(`/api/treasury/transactions${params}`);
      if (transactionsRes.ok) setTransactions((await transactionsRes.json()).data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  function walletName(walletId?: string, joinedName?: string | null): string {
    if (joinedName) return joinedName;
    if (!walletId) return '—';
    const w = wallets.find((x) => (x as any).Id === walletId || (x as any).id === walletId || x.WalletId === walletId);
    return w?.Name || 'Inconnu';
  }

  const fmtDate = (s: string) =>
    new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s));

  const totals = {
    income: transactions.filter((t) => t.Type === 'income').reduce((s, t) => s + Number(t.Amount), 0),
    expense: transactions.filter((t) => t.Type === 'expense').reduce((s, t) => s + Number(t.Amount), 0),
  };

  const META: Record<string, { icon: React.ReactNode; chip: string; color: string; sign: string; label: string }> = {
    income: { icon: <ArrowDownCircle className="w-5 h-5" />, chip: 'bg-emerald-100 text-emerald-700', color: 'text-emerald-600', sign: '+', label: 'Revenu' },
    expense: { icon: <ArrowUpCircle className="w-5 h-5" />, chip: 'bg-red-100 text-red-700', color: 'text-red-600', sign: '-', label: 'Dépense' },
    transfer: { icon: <ArrowRightLeft className="w-5 h-5" />, chip: 'bg-blue-100 text-blue-700', color: 'text-blue-600', sign: '→', label: 'Transfert' },
  };

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-16">
        {/* Header compact */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => router.push('/treasury')} aria-label="Retour"
                className="p-2 bg-white/20 rounded-full hover:bg-white/30 shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">Transactions</h1>
                <p className="text-[11px] sm:text-sm opacity-90 truncate">{transactions.length} opération(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={handleRefresh} disabled={refreshing} aria-label="Rafraîchir"
                className="p-2.5 bg-white/20 rounded-full hover:bg-white/30">
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => router.push('/treasury/transactions/new')} aria-label="Nouvelle transaction"
                className="p-2.5 bg-white/20 rounded-full hover:bg-white/30">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4">
          {/* Totaux */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 text-emerald-700 rounded-xl px-2 py-2.5 text-center">
              <p className="text-sm sm:text-lg font-bold tabular-nums">{fmtCompact(totals.income)}</p>
              <p className="text-[10px] font-medium opacity-70">Revenus</p>
            </div>
            <div className="bg-red-50 text-red-700 rounded-xl px-2 py-2.5 text-center">
              <p className="text-sm sm:text-lg font-bold tabular-nums">{fmtCompact(totals.expense)}</p>
              <p className="text-[10px] font-medium opacity-70">Dépenses</p>
            </div>
            <div className={`rounded-xl px-2 py-2.5 text-center ${totals.income - totals.expense >= 0 ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-700'}`}>
              <p className="text-sm sm:text-lg font-bold tabular-nums">{fmtCompact(totals.income - totals.expense)}</p>
              <p className="text-[10px] font-medium opacity-70">Solde net</p>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {([['all', 'Toutes'], ['income', 'Revenus'], ['expense', 'Dépenses'], ['transfer', 'Transferts']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ' +
                  (filter === k ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-gray-300 text-gray-700')}>
                {lbl}
              </button>
            ))}
          </div>

          {/* Liste */}
          {loading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : transactions.length === 0 ? (
            <div className="bg-white border-2 border-gray-200 rounded-2xl py-12 text-center">
              <p className="text-sm text-gray-500 mb-3">Aucune transaction</p>
              <button onClick={() => router.push('/treasury/transactions/new')}
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold">Créer une transaction</button>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((t) => {
                const m = META[t.Type] || META.transfer;
                const flow =
                  t.Type === 'income' ? `→ ${walletName(t.DestinationWalletId, (t as any).DestinationWalletName)}`
                  : t.Type === 'expense' ? `${walletName(t.SourceWalletId, (t as any).SourceWalletName)} →`
                  : `${walletName(t.SourceWalletId, (t as any).SourceWalletName)} → ${walletName(t.DestinationWalletId, (t as any).DestinationWalletName)}`;
                return (
                  <div key={t.TransactionId} className="bg-white border-2 border-gray-100 rounded-2xl p-3 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.chip}`}>{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{t.Description}</p>
                      <p className="text-xs text-gray-500 truncate">{flow}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {CATEGORY_LABELS[t.Category] || t.Category} · {fmtDate(t.ProcessedAt)}
                        {t.Status !== 'completed' && <span className="text-amber-600 font-semibold"> · {t.Status === 'pending' ? 'en attente' : 'annulé'}</span>}
                      </p>
                    </div>
                    <p className={`text-sm font-bold tabular-nums shrink-0 ${m.color}`}>
                      {m.sign} {fmtCompact(Number(t.Amount))}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}
