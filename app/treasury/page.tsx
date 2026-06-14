'use client';

/**
 * Page - Trésorerie Multi-wallet — mobile-first.
 *
 * Standard maison : ÉTAT DES LIEUX d'abord (soldes + flux, chiffres
 * cliquables), portefeuilles en liste compacte, transactions récentes
 * filtrables. L'équation comptable du solde est repliée (utile au
 * comptable, hors du chemin du lecteur pressé).
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet as WalletIcon, Plus, RefreshCw, ChevronDown, ChevronUp,
  CreditCard, Repeat,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Wallet, Transaction, TreasuryStatistics } from '@/types/modules';
import { fmtXOF } from '@/lib/utils/format-number';

const fmtCompact = (n: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M F';
  return new Intl.NumberFormat('fr-FR').format(Math.round(v)) + ' F';
};

const WALLET_EMOJI: Record<string, string> = { cash: '💵', bank: '🏦', mobile_money: '📱', other: '💰' };

export default function TreasuryPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [statistics, setStatistics] = React.useState<TreasuryStatistics | null>(null);
  const [filter, setFilter] = React.useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [showEquation, setShowEquation] = React.useState(false);

  React.useEffect(() => { loadData(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    try {
      const walletsResponse = await fetch('/api/treasury/wallets?isActive=true');
      setWallets((await walletsResponse.json()).data || []);
      const params = filter !== 'all' ? `?type=${filter}` : '';
      const transactionsResponse = await fetch(`/api/treasury/transactions${params}`);
      setTransactions((await transactionsResponse.json()).data || []);
      const statsResponse = await fetch('/api/treasury/statistics');
      setStatistics((await statsResponse.json()).data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const fmtDate = (s: string) =>
    new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
  const txColor = (t: string) => t === 'income' ? 'text-emerald-600' : t === 'expense' ? 'text-red-600' : 'text-blue-600';
  const txSign = (t: string) => t === 'income' ? '+' : t === 'expense' ? '-' : '→';

  const st = statistics;

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-16">
        {/* Header compact */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <WalletIcon className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">Trésorerie</h1>
                <p className="text-[11px] sm:text-sm opacity-90 truncate">Caisses, banques, mobile money</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={handleRefresh} disabled={refreshing} aria-label="Rafraîchir"
                className="p-2.5 bg-white/20 rounded-full hover:bg-white/30">
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4">
          {/* ===== ÉTAT DES LIEUX ===== */}
          <section className="bg-white border-2 border-emerald-200 rounded-2xl p-3 sm:p-4">
            <h2 className="text-sm sm:text-base font-bold text-emerald-900 mb-2">État des lieux</h2>
            {loading || !st ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <Stat label="Solde total" value={fmtCompact(st.totalBalance)} tone="amber"
                    sub={`${st.walletsCount} wallet(s)`} />
                  <Stat label="Revenus" value={fmtCompact(st.totalIncome)} tone="green"
                    onClick={() => setFilter('income')} />
                  <Stat label="Dépenses" value={fmtCompact(st.totalExpense)} tone="red"
                    onClick={() => setFilter('expense')} />
                  <Stat label="Ajustements"
                    value={(st.totalAdjustments >= 0 ? '+' : '') + fmtCompact(st.totalAdjustments)} />
                  <Stat label="Transferts" value={fmtCompact(st.totalTransfers)}
                    onClick={() => setFilter('transfer')} />
                  <Stat label="Solde initial" value={fmtCompact(st.totalInitialBalance)} />
                </div>
                <button onClick={() => setShowEquation(v => !v)}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-emerald-700">
                  {showEquation ? 'Masquer' : 'Comment se compose le solde'} {showEquation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showEquation && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-[11px] text-gray-700 leading-relaxed">
                    <p className="font-semibold mb-1">Solde = Initial + Revenus + Ajustements − Dépenses</p>
                    <p className="font-mono">
                      {fmtXOF(st.totalBalance)} = {fmtXOF(st.totalInitialBalance)} +{' '}
                      <span className="text-emerald-700">{fmtXOF(st.totalIncome)}</span> +{' '}
                      <span className={st.totalAdjustments >= 0 ? 'text-emerald-700' : 'text-orange-700'}>
                        {st.totalAdjustments >= 0 ? '+' : ''}{fmtXOF(st.totalAdjustments)}
                      </span> − <span className="text-red-700">{fmtXOF(st.totalExpense)}</span>
                    </p>
                    <p className="text-gray-400 mt-1">Les transferts sont internes (neutres sur le solde total).</p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ===== ACTIONS + CONFIG ===== */}
          <Can permission={PERMISSIONS.TREASURY_CREATE}>
            <section className="grid grid-cols-2 gap-2.5">
              <ActionCard onClick={() => router.push('/treasury/transactions/new')}
                icon={<Plus className="w-6 h-6" />} title="Nouvelle transaction" sub="Entrée / sortie / transfert" tone="emerald" />
              <ActionCard onClick={() => router.push('/treasury/wallets/new')}
                icon={<WalletIcon className="w-6 h-6" />} title="Nouveau portefeuille" sub="Caisse, banque, momo" tone="blue" />
            </section>
          </Can>

          {/* ===== PORTEFEUILLES ===== */}
          <section className="bg-white border-2 border-gray-200 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Portefeuilles</h2>
              <Link href="/treasury/wallets" className="text-xs font-bold text-emerald-700 hover:underline">Tous →</Link>
            </div>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : wallets.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Aucun portefeuille actif</p>
            ) : (
              <div className="space-y-2">
                {wallets.map((w) => (
                  <button key={w.WalletId} onClick={() => router.push(`/treasury/wallets/${w.WalletId}`)}
                    className="w-full flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5 hover:bg-gray-100 active:scale-[0.99]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl shrink-0">{WALLET_EMOJI[w.Type] || '💰'}</span>
                      <div className="min-w-0 text-left">
                        <p className="font-semibold text-sm truncate">{w.Name}</p>
                        <p className="text-xs text-gray-400">{w.Code}</p>
                      </div>
                    </div>
                    <p className="font-bold tabular-nums shrink-0">{fmtCompact(Number(w.Balance))}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ===== TRANSACTIONS ===== */}
          <section className="bg-white border-2 border-gray-200 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Transactions récentes</h2>
              <Link href="/treasury/transactions" className="text-xs font-bold text-emerald-700 hover:underline">Toutes →</Link>
            </div>
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
              {([['all', 'Tout'], ['income', 'Revenus'], ['expense', 'Dépenses'], ['transfer', 'Transferts']] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ' +
                    (filter === k ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-gray-300 text-gray-700')}>
                  {lbl}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">Aucune transaction</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {transactions.slice(0, 12).map((t) => (
                  <div key={t.TransactionId} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.Description}</p>
                      <p className="text-xs text-gray-400 truncate">{t.TransactionNumber} · {fmtDate(t.ProcessedAt)}</p>
                    </div>
                    <p className={`text-sm font-bold tabular-nums shrink-0 ${txColor(t.Type)}`}>
                      {txSign(t.Type)} {fmtCompact(Number(t.Amount))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ===== CONFIG ===== */}
          <section className="grid grid-cols-2 gap-2.5">
            <NavCard onClick={() => router.push('/treasury/wallets/inventory')} icon={<WalletIcon className="w-5 h-5" />} title="Inventaire caisses" />
            <Can permission={PERMISSIONS.PAYMENT_METHOD_VIEW}>
              <NavCard onClick={() => router.push('/treasury/payment-methods')} icon={<CreditCard className="w-5 h-5" />} title="Moyens de paiement" />
            </Can>
            <NavCard onClick={() => router.push('/treasury/cash-deposits')} icon={<Repeat className="w-5 h-5" />} title="Versements caisse" />
          </section>
        </div>
      </div>
    </ProtectedPage>
  );
}

function Stat({ label, value, tone, sub, onClick }: {
  label: string; value: string; tone?: 'amber' | 'red' | 'green'; sub?: string; onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-900', red: 'bg-red-50 text-red-700', green: 'bg-emerald-50 text-emerald-700',
  };
  const cls = `block w-full rounded-lg px-2 py-2 text-center ${tone ? tones[tone] : 'bg-gray-50 text-gray-900'}` +
    (onClick ? ' active:scale-95 hover:ring-2 hover:ring-emerald-300' : '');
  const inner = (
    <>
      <p className="text-sm sm:text-lg font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-gray-400 leading-tight">{sub}</p>}
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{inner}</button> : <div className={cls}>{inner}</div>;
}

function ActionCard({ onClick, icon, title, sub, tone }: {
  onClick: () => void; icon: React.ReactNode; title: string; sub: string; tone: 'emerald' | 'blue';
}) {
  const chips: Record<string, { chip: string; border: string }> = {
    emerald: { chip: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200 hover:border-emerald-400' },
    blue: { chip: 'bg-blue-100 text-blue-700', border: 'border-blue-200 hover:border-blue-400' },
  };
  return (
    <button onClick={onClick}
      className={`text-left bg-white border-2 rounded-2xl p-3.5 flex flex-col gap-2 transition-all active:scale-[0.99] ${chips[tone].border}`}>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${chips[tone].chip}`}>{icon}</span>
      <span>
        <span className="block font-bold text-sm text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{sub}</span>
      </span>
    </button>
  );
}

function NavCard({ onClick, icon, title }: { onClick: () => void; icon: React.ReactNode; title: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2.5 bg-white border-2 border-gray-200 hover:border-emerald-300 rounded-2xl p-3.5 transition-all active:scale-[0.99]">
      <span className="w-9 h-9 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center shrink-0">{icon}</span>
      <span className="font-bold text-sm text-gray-900 text-left">{title}</span>
    </button>
  );
}
