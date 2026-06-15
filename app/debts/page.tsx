'use client';

/**
 * Page - Dettes & créances (cockpit unifié) — mobile-first.
 *
 * État des lieux des comptes de tiers (classe 4) : à payer (fournisseurs,
 * salaires, charges sociales) et à recevoir (clients, avances personnel).
 * Chaque chiffre → détail par tiers, avec accès au règlement.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Scale, RefreshCw, ArrowRight } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';

const fmtF = (n: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M F';
  return new Intl.NumberFormat('fr-FR').format(Math.round(v)) + ' F';
};

export default function DebtsPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drill, setDrill] = useState<{ title: string; rows: any[]; settleHref?: string } | null>(null);
  const [drillKey, setDrillKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/debts');
      if (r.ok) setData((await r.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function openDrill(kind: string) {
    setDrillKey(kind);
    try {
      const r = await fetch(`/api/debts?kind=${kind}`);
      if (r.ok) setDrill((await r.json()).data);
    } finally {
      setDrillKey(null);
    }
  }

  const d = data;

  return (
    <ProtectedPage permission={PERMISSIONS.TREASURY_VIEW}>
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 pb-16">
        <div className="bg-gradient-to-r from-rose-600 to-orange-600 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-10 shadow-lg">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Scale className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">Dettes & créances</h1>
                <p className="text-[11px] sm:text-sm opacity-90 truncate">Ce qu'on doit · ce qu'on nous doit</p>
              </div>
            </div>
            <button onClick={refresh} disabled={refreshing} aria-label="Rafraîchir"
              className="p-2.5 bg-white/20 rounded-full hover:bg-white/30 shrink-0">
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4">
          {loading || !d ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* À PAYER */}
              <section className="bg-white border-2 border-red-200 rounded-2xl p-3 sm:p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="text-sm sm:text-base font-bold text-red-800">À payer (nous devons)</h2>
                  <span className="text-sm font-bold text-red-700 tabular-nums">{fmtF(d.toPay.total)}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <Stat label="Fournisseurs" value={fmtF(d.toPay.suppliers)} tone="red"
                    onClick={() => openDrill('suppliers')} loading={drillKey === 'suppliers'} />
                  <Stat label="Salaires" value={fmtF(d.toPay.salaries)} tone="red"
                    onClick={() => openDrill('salaries')} loading={drillKey === 'salaries'} />
                  <Stat label="Charges sociales" value={fmtF(d.toPay.socialCharges)} tone="red"
                    onClick={() => openDrill('socialCharges')} loading={drillKey === 'socialCharges'} />
                </div>
              </section>

              {/* À RECEVOIR */}
              <section className="bg-white border-2 border-emerald-200 rounded-2xl p-3 sm:p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="text-sm sm:text-base font-bold text-emerald-800">À recevoir (on nous doit)</h2>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums">{fmtF(d.toReceive.total)}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <Stat label="Clients (crédit)" value={fmtF(d.toReceive.clients)} tone="green"
                    onClick={() => openDrill('clients')} loading={drillKey === 'clients'} />
                  <Stat label="Avances personnel" value={fmtF(d.toReceive.staffAdvances)} tone="green"
                    onClick={() => openDrill('staffAdvances')} loading={drillKey === 'staffAdvances'} />
                  <Stat label="Position nette"
                    value={(d.netPosition >= 0 ? '+' : '') + fmtF(d.netPosition)}
                    tone={d.netPosition >= 0 ? 'green' : 'red'} />
                </div>
              </section>
              <p className="text-[10px] text-gray-400 text-center">Touchez un chiffre pour le détail par tiers</p>
            </>
          )}

          {/* Détail (drill) */}
          {drill && (
            <section className="bg-white border-2 border-rose-300 rounded-2xl p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="text-sm sm:text-base font-bold text-rose-900">{drill.title}</h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  {drill.settleHref && (
                    <Link href={drill.settleHref}
                      className="px-2.5 py-1 rounded-full bg-rose-700 text-white text-xs font-bold hover:bg-rose-800 inline-flex items-center gap-1">
                      Régler <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                  <button onClick={() => setDrill(null)}
                    className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200">
                    Fermer ✕
                  </button>
                </div>
              </div>
              {drill.rows.length === 0 ? (
                <p className="text-sm text-gray-500 py-3 text-center">Rien à afficher.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {drill.rows.map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        {r.sub && <p className="text-xs text-gray-500 truncate">{r.sub}</p>}
                      </div>
                      <p className="text-sm font-bold tabular-nums shrink-0">{fmtF(r.value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}

function Stat({ label, value, tone, onClick, loading }: {
  label: string; value: string; tone?: 'red' | 'green'; onClick?: () => void; loading?: boolean;
}) {
  const tones: Record<string, string> = { red: 'bg-red-50 text-red-700', green: 'bg-emerald-50 text-emerald-700' };
  const cls = `block w-full rounded-lg px-2 py-2 text-center ${tone ? tones[tone] : 'bg-gray-50 text-gray-900'}` +
    (onClick ? ' active:scale-95 hover:ring-2 hover:ring-rose-300' : '');
  const inner = (
    <>
      <p className="text-sm sm:text-lg font-bold tabular-nums leading-tight">{loading ? '…' : value}</p>
      <p className="text-[10px] sm:text-xs font-medium opacity-70 leading-tight mt-0.5">{label}</p>
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{inner}</button> : <div className={cls}>{inner}</div>;
}
