'use client';

/**
 * Page - Balance Générale
 * Soldes débit/crédit par compte sur l'exercice (API trial-balance).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Scale } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';
import type { TrialBalance } from '@/types/modules';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

export default function TrialBalancePage() {
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [rows, setRows] = useState<TrialBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/accounting/reports/trial-balance?fiscalYear=${year}`);
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
      const { data } = await r.json();
      setRows((data || []).sort((a: TrialBalance, b: TrialBalance) =>
        a.AccountNumber.localeCompare(b.AccountNumber)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(fiscalYear); }, [fiscalYear, load]);

  const totals = rows.reduce(
    (acc, r) => {
      acc.debit += Number(r.PeriodDebit || 0);
      acc.credit += Number(r.PeriodCredit || 0);
      return acc;
    },
    { debit: 0, credit: 0 }
  );
  const balanced = Math.abs(totals.debit - totals.credit) < 0.01;

  return (
    <ProtectedPage permission={PERMISSIONS.REPORTS_VIEW}>
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link href="/accounting" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Comptabilité
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Scale className="w-7 h-7 text-amber-700" /> Balance Générale
            </h1>
            <p className="text-muted-foreground">Soldes par compte — écritures comptabilisées</p>
          </div>
          <label className="text-sm text-gray-600 inline-flex items-center gap-2">
            Exercice
            <select
              value={fiscalYear}
              onChange={e => setFiscalYear(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
            >
              {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              Aucune écriture comptabilisée sur l'exercice {fiscalYear} — la balance est vide.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-2 w-28">Compte</th>
                    <th className="text-left py-2">Libellé</th>
                    <th className="text-right py-2 w-36">Débit</th>
                    <th className="text-right py-2 w-36">Crédit</th>
                    <th className="text-right py-2 w-36">Solde</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const solde = Number(r.PeriodDebit || 0) - Number(r.PeriodCredit || 0);
                    return (
                      <tr key={r.AccountNumber} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-2 font-mono text-xs font-semibold">{r.AccountNumber}</td>
                        <td className="py-2">{r.AccountLabel}</td>
                        <td className="py-2 text-right tabular-nums">{fmt(r.PeriodDebit)}</td>
                        <td className="py-2 text-right tabular-nums">{fmt(r.PeriodCredit)}</td>
                        <td className={'py-2 text-right tabular-nums font-semibold ' + (solde >= 0 ? 'text-gray-900' : 'text-red-600')}>
                          {fmt(Math.abs(solde))} {solde >= 0 ? 'D' : 'C'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="py-2.5" colSpan={2}>Totaux</td>
                    <td className="py-2.5 text-right tabular-nums">{fmt(totals.debit)}</td>
                    <td className="py-2.5 text-right tabular-nums">{fmt(totals.credit)}</td>
                    <td className={'py-2.5 text-right text-xs ' + (balanced ? 'text-emerald-600' : 'text-red-600')}>
                      {balanced ? '✓ Équilibrée' : '⚠ Déséquilibre ' + fmt(totals.debit - totals.credit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedPage>
  );
}
