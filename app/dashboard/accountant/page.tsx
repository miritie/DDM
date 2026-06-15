'use client';

/**
 * Dashboard Comptable — mobile-first.
 *
 * Standard maison : ÉTAT DES LIEUX d'abord (9 chiffres, chacun
 * CLIQUABLE vers son détail), puis les actions du métier (payer une
 * dépense, transactions, paie, charges sociales), puis les accès
 * (comptabilité, rapports). Les alertes remontent au-dessus de tout.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet, Receipt, BadgeDollarSign, Landmark, Calculator,
  AlertTriangle, RefreshCw, FileBarChart, Repeat, HandCoins,
} from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';

interface AccountantDashboardData {
  treasury: { totalBalance: number; cashBalance: number; bankBalance: number; mobileMoneyBalance: number };
  expenses: { today: number; week: number; month: number; pendingApproval: number };
  payroll: { totalEmployees: number; totalSalaries: number; pendingAdvances: number; nextPayrollDate: string };
  sales: { revenue: number; receivables: number; collected: number };
  alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string; link?: string }>;
}

const fmtF = (n: number) => {
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M F';
  }
  return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' F';
};

export default function AccountantDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AccountantDashboardData | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');

  useEffect(() => { loadDashboard(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard/accountant?period=${period}`);
      const result = await response.json();
      if (response.ok) setData(result.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  // Outbox comptable : écritures en attente de régularisation
  const [pending, setPending] = useState(0);
  const [regularizing, setRegularizing] = useState(false);
  const [regulMsg, setRegulMsg] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/accounting/outbox').then(r => r.ok ? r.json() : null)
      .then(b => b?.data && setPending(b.data.pending)).catch(() => {});
  }, []);
  async function regularize() {
    setRegularizing(true);
    setRegulMsg(null);
    try {
      const r = await fetch('/api/accounting/outbox', { method: 'POST' });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || 'Échec');
      setPending(b.data?.remaining ?? 0);
      setRegulMsg(`${b.data?.done ?? 0} écriture(s) régularisée(s)` +
        (b.data?.remaining ? ` · ${b.data.remaining} en échec (plan comptable ?)` : ' · tout est à jour'));
    } catch (e: any) {
      setRegulMsg(`❌ ${e.message}`);
    } finally {
      setRegularizing(false);
    }
  }

  const d = data;
  const expensePeriod = d ? (period === 'today' ? d.expenses.today : period === 'week' ? d.expenses.week : d.expenses.month) : 0;
  const PERIOD_LABEL: Record<string, string> = { today: 'du jour', week: '7 jours', month: '30 jours' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-16">
      {/* Header compact */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Calculator className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold truncate">Comptabilité</h1>
              <p className="text-[11px] sm:text-sm opacity-90 truncate">Finance & trésorerie</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={handleRefresh} disabled={refreshing} aria-label="Rafraîchir"
              className="p-2.5 bg-white/20 rounded-full hover:bg-white/30">
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <LogoutButton variant="ghost" size="sm" showText={false}
              className="p-2.5 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 text-white" />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4">
        {/* Alertes */}
        {d?.alerts && d.alerts.length > 0 && (
          <div className="space-y-2">
            {d.alerts.map((alert, idx) => (
              <button key={idx}
                onClick={() => alert.link && router.push(alert.link)}
                className={'w-full text-left flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm ' +
                  (alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-800'
                    : alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800')}>
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="font-medium">{alert.message}</span>
              </button>
            ))}
          </div>
        )}

        {/* Écritures comptables en attente (outbox) */}
        {(pending > 0 || regulMsg) && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-amber-900">
                {pending > 0
                  ? `${pending} écriture(s) comptable(s) en attente`
                  : 'Écritures comptables à jour'}
              </p>
              {pending > 0 && (
                <button onClick={regularize} disabled={regularizing}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 disabled:opacity-50">
                  {regularizing ? 'Régularisation…' : 'Régulariser'}
                </button>
              )}
            </div>
            {regulMsg && <p className="text-xs text-amber-800 mt-1">{regulMsg}</p>}
          </div>
        )}

        {/* Sélecteur de période (dépenses + CA) */}
        <div className="flex gap-1.5">
          {(['today', 'week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={'px-3 py-1.5 rounded-full text-xs font-semibold border ' +
                (period === p ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50')}>
              {p === 'today' ? "Aujourd'hui" : PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        {/* ===== ÉTAT DES LIEUX : 9 chiffres cliquables ===== */}
        <section className="bg-white border-2 border-emerald-200 rounded-2xl p-3 sm:p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm sm:text-base font-bold text-emerald-900">État des lieux</h2>
            <span className="text-[10px] text-gray-400">
              {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </span>
          </div>
          {loading || !d ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <Stat label="Trésorerie totale" value={fmtF(d.treasury.totalBalance)} tone="amber" href="/treasury" />
              <Stat label="Caisses (espèces)" value={fmtF(d.treasury.cashBalance)} href="/treasury" />
              <Stat label="Banque" value={fmtF(d.treasury.bankBalance)} href="/treasury" />
              <Stat label={`CA ${PERIOD_LABEL[period]}`} value={fmtF(d.sales.revenue)} tone="amber" href="/reports" />
              <Stat label="À recouvrer" value={fmtF(d.sales.receivables)}
                tone={d.sales.receivables > 0 ? 'amber' : 'green'} href="/sales?filter=pending" />
              <Stat label={`Dépenses ${PERIOD_LABEL[period]}`} value={fmtF(expensePeriod)} href="/treasury/transactions" />
              <Stat label="Dépenses à valider" value={String(d.expenses.pendingApproval)}
                tone={d.expenses.pendingApproval > 0 ? 'red' : 'green'} href="/expenses/requests?status=submitted" />
              <Stat label="Masse salariale" value={fmtF(d.payroll.totalSalaries)}
                href="/hr/payroll" sub={`${d.payroll.totalEmployees} employé(s)`} />
              <Stat label="Avances en attente" value={String(d.payroll.pendingAdvances)}
                tone={d.payroll.pendingAdvances > 0 ? 'amber' : undefined} href="/advances-debts" />
            </div>
          )}
          <p className="text-[10px] text-gray-400 text-center mt-2">Touchez un chiffre pour voir le détail</p>
        </section>

        {/* ===== ACTIONS DU MÉTIER ===== */}
        <section className="grid grid-cols-2 gap-2.5">
          <ActionCard href="/expenses/requests?status=submitted" icon={<Receipt className="w-6 h-6" />}
            title="Payer une dépense" sub="File de validation" tone="emerald"
            badge={d?.expenses.pendingApproval} />
          <ActionCard href="/treasury/transactions" icon={<Repeat className="w-6 h-6" />}
            title="Transactions" sub="Mouvements de trésorerie" tone="blue" />
          <ActionCard href="/hr/payroll" icon={<BadgeDollarSign className="w-6 h-6" />}
            title="Gérer la paie" sub="Bulletins & versements" tone="purple" />
          <ActionCard href="/hr/payroll/charges" icon={<Landmark className="w-6 h-6" />}
            title="Charges sociales" sub="CNPS · DGI · FDFP" tone="amber" />
        </section>

        {/* ===== PILOTAGE & ACCÈS ===== */}
        <section className="grid grid-cols-2 gap-2.5">
          <NavCard href="/accounting" icon={<Calculator className="w-5 h-5" />} title="Comptabilité" />
          <NavCard href="/reports/financial" icon={<FileBarChart className="w-5 h-5" />} title="Rapports financiers" />
          <NavCard href="/treasury/wallets/inventory" icon={<Wallet className="w-5 h-5" />} title="Inventaire caisses" />
          <NavCard href="/debts" icon={<HandCoins className="w-5 h-5" />} title="Dettes & créances" />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, href, sub }: {
  label: string; value: string; tone?: 'amber' | 'red' | 'green'; href?: string; sub?: string;
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-900',
    red: 'bg-red-50 text-red-700',
    green: 'bg-emerald-50 text-emerald-700',
  };
  const cls = `block rounded-lg px-2 py-2 text-center ${tone ? tones[tone] : 'bg-gray-50 text-gray-900'}` +
    (href ? ' active:scale-95 hover:ring-2 hover:ring-emerald-300' : '');
  const inner = (
    <>
      <p className="text-base sm:text-xl font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-gray-400 leading-tight">{sub}</p>}
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function ActionCard({ href, icon, title, sub, tone, badge }: {
  href: string; icon: React.ReactNode; title: string; sub: string;
  tone: 'emerald' | 'amber' | 'blue' | 'purple'; badge?: number;
}) {
  const chips: Record<string, { chip: string; border: string }> = {
    emerald: { chip: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200 hover:border-emerald-400' },
    amber: { chip: 'bg-amber-100 text-amber-700', border: 'border-amber-200 hover:border-amber-400' },
    blue: { chip: 'bg-blue-100 text-blue-700', border: 'border-blue-200 hover:border-blue-400' },
    purple: { chip: 'bg-purple-100 text-purple-700', border: 'border-purple-200 hover:border-purple-400' },
  };
  return (
    <Link href={href}
      className={`relative bg-white border-2 rounded-2xl p-3.5 flex flex-col gap-2 transition-all active:scale-[0.99] ${chips[tone].border}`}>
      {badge ? (
        <span className="absolute top-2 right-2 min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
          {badge}
        </span>
      ) : null}
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${chips[tone].chip}`}>
        {icon}
      </span>
      <span>
        <span className="block font-bold text-sm text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500">{sub}</span>
      </span>
    </Link>
  );
}

function NavCard({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-2.5 bg-white border-2 border-gray-200 hover:border-emerald-300 rounded-2xl p-3.5 transition-all active:scale-[0.99]">
      <span className="w-9 h-9 rounded-lg bg-gray-50 text-gray-600 flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="font-bold text-sm text-gray-900">{title}</span>
    </Link>
  );
}
