'use client';

/**
 * Page - Bilan (Actif / Passif)
 *
 * Bilan simplifié construit depuis la balance générale (API trial-balance) :
 *   Actif  = classes 2 (immobilisations), 3 (stocks), 5 (trésorerie)
 *            + comptes de tiers (classe 4) à solde débiteur (créances)
 *   Passif = classe 1 (capitaux) + tiers à solde créditeur (dettes)
 *            + résultat de l'exercice (produits 7 − charges 6)
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Landmark } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrialBalance } from '@/types/modules';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

interface BilanLine { number: string; label: string; amount: number }

function buildBilan(rows: TrialBalance[]) {
  const actif: BilanLine[] = [];
  const passif: BilanLine[] = [];
  let resultat = 0;

  for (const r of rows) {
    const solde = Number(r.PeriodDebit || 0) - Number(r.PeriodCredit || 0);
    if (Math.abs(solde) < 0.005) continue;
    const cls = r.AccountNumber.charAt(0);
    const line = { number: r.AccountNumber, label: r.AccountLabel, amount: Math.abs(solde) };

    // Résultat = Produits (solde créditeur de 7 = −solde) − Charges (solde
    // débiteur de 6 = +solde) → dans les deux cas : résultat −= solde.
    if (cls === '6' || cls === '7') { resultat -= solde; continue; }

    if (cls === '2' || cls === '3' || cls === '5') {
      if (solde >= 0) actif.push(line);
      else passif.push(line); // ex : banque à découvert (classe 5 créditrice)
    } else if (cls === '4') {
      (solde >= 0 ? actif : passif).push(line);
    } else {
      // classe 1 (capitaux) et autres : passif si créditeur, actif sinon
      (solde < 0 ? passif : actif).push(line);
    }
  }

  const totalActif = actif.reduce((s, l) => s + l.amount, 0);
  const totalPassifHorsResultat = passif.reduce((s, l) => s + l.amount, 0);
  return { actif, passif, resultat, totalActif, totalPassif: totalPassifHorsResultat + resultat };
}

function BilanColumn({ title, lines, extra, total, accent }: {
  title: string;
  lines: BilanLine[];
  extra?: { label: string; amount: number } | null;
  total: number;
  accent: string;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className={`text-base ${accent}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {lines.length === 0 && !extra ? (
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
              {extra && (
                <tr className="border-b last:border-b-0 italic">
                  <td className="py-1.5" />
                  <td className="py-1.5">{extra.label}</td>
                  <td className={'py-1.5 text-right tabular-nums ' + (extra.amount >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                    {fmt(extra.amount)}
                  </td>
                </tr>
              )}
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

export default function BalanceSheetPage() {
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

  const bilan = buildBilan(rows);

  return (
    <ProtectedPage permission={PERMISSIONS.REPORTS_VIEW}>
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link href="/accounting" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Comptabilité
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Landmark className="w-7 h-7 text-amber-700" /> Bilan
            </h1>
            <p className="text-muted-foreground">Bilan simplifié construit depuis la balance — exercice {fiscalYear}</p>
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
              Aucune écriture comptabilisée sur l'exercice {fiscalYear} — le bilan est vide.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <BilanColumn
              title="ACTIF"
              accent="text-blue-800"
              lines={bilan.actif}
              total={bilan.totalActif}
            />
            <BilanColumn
              title="PASSIF"
              accent="text-amber-800"
              lines={bilan.passif}
              extra={{ label: `Résultat de l'exercice`, amount: bilan.resultat }}
              total={bilan.totalPassif}
            />
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
