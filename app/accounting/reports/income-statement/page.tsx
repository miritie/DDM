'use client';

/**
 * Page - Compte de Résultat (Produits / Charges)
 *
 * Construit depuis la balance générale (API trial-balance) :
 *   Charges  = classe 6 (solde débiteur)
 *   Produits = classe 7 (solde créditeur)
 *   Résultat = Produits − Charges
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, TrendingUp } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrialBalance } from '@/types/modules';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

interface ResultLine { number: string; label: string; amount: number }

function ResultColumn({ title, lines, total, accent }: {
  title: string;
  lines: ResultLine[];
  total: number;
  accent: string;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className={`text-base ${accent}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {lines.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucun élément</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {lines.map(l => (
                <tr key={l.number} className="border-b last:border-b-0">
                  <td className="py-1.5 font-mono text-xs text-gray-500 w-24">{l.number}</td>
                  <td className="py-1.5">{l.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td className="py-2" colSpan={2}>Total</td>
                <td className="py-2 text-right tabular-nums">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default function IncomeStatementPage() {
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
      setRows(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(fiscalYear); }, [fiscalYear, load]);

  const charges: ResultLine[] = [];
  const produits: ResultLine[] = [];
  for (const r of rows) {
    const solde = Number(r.PeriodDebit || 0) - Number(r.PeriodCredit || 0);
    if (Math.abs(solde) < 0.005) continue;
    const cls = r.AccountNumber.charAt(0);
    if (cls === '6') charges.push({ number: r.AccountNumber, label: r.AccountLabel, amount: solde });
    if (cls === '7') produits.push({ number: r.AccountNumber, label: r.AccountLabel, amount: -solde });
  }
  const totalCharges = charges.reduce((s, l) => s + l.amount, 0);
  const totalProduits = produits.reduce((s, l) => s + l.amount, 0);
  const resultat = totalProduits - totalCharges;

  return (
    <ProtectedPage permission={PERMISSIONS.REPORTS_VIEW}>
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link href="/accounting" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Comptabilité
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-amber-700" /> Compte de Résultat
            </h1>
            <p className="text-muted-foreground">Produits et charges — exercice {fiscalYear}</p>
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
              Aucune écriture comptabilisée sur l'exercice {fiscalYear} — le compte de résultat est vide.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <ResultColumn title="CHARGES (classe 6)" accent="text-red-700" lines={charges} total={totalCharges} />
              <ResultColumn title="PRODUITS (classe 7)" accent="text-emerald-700" lines={produits} total={totalProduits} />
            </div>
            <Card className={resultat >= 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}>
              <CardContent className="py-4 flex items-center justify-between">
                <span className="font-semibold">
                  {resultat >= 0 ? 'Bénéfice de l\'exercice' : 'Perte de l\'exercice'}
                </span>
                <span className={'text-2xl font-bold tabular-nums ' + (resultat >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                  {fmt(Math.abs(resultat))} XOF
                </span>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
