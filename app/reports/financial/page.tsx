'use client';

/**
 * Page - Rapports Financiers réglementaires (Côte d'Ivoire / SYSCOHADA révisé)
 *
 * 1. Échéancier réglementaire avec périodicité légale :
 *    - TVA : déclaration et paiement MENSUELS (au plus tard le 15 du mois
 *      suivant au réel normal ; le 10 pour les entreprises relevant de la DGE)
 *    - ITS (impôts sur salaires) & CNPS : mensuels (le 15 du mois suivant)
 *    - Clôture de l'exercice : 31 décembre (exercice = année civile, AUDCIF)
 *    - États financiers annuels SYSCOHADA + approbation AGO : dans les
 *      6 mois de la clôture (au plus tard le 30 juin, AUSCGIE)
 *    - Dépôt de la liasse (DSF) à la DGI : au plus tard le 30 juin
 * 2. États financiers SYSCOHADA (Système Normal) : Bilan, Compte de
 *    résultat, Balance — produits par le module Comptabilité — et Tableau
 *    des flux de trésorerie simplifié (méthode directe) généré ici depuis
 *    les transactions de trésorerie. Les Notes annexes restent à rédiger
 *    par le comptable (état narratif).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Landmark, TrendingUp, Scale, FileSpreadsheet,
  CalendarClock, ArrowDownCircle, ArrowUpCircle, WalletCards,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

// ---------------------------------------------------------------------------
// Échéancier réglementaire (périodicité légale CI)

interface Deadline {
  label: string;
  detail: string;
  due: Date;
  recurring: 'mensuel' | 'annuel';
}

function buildDeadlines(now: Date): Deadline[] {
  const y = now.getFullYear();
  // Prochaine échéance mensuelle : le 15 du mois suivant (TVA/ITS/CNPS au réel normal)
  const next15 = new Date(y, now.getMonth() + (now.getDate() > 15 ? 1 : 0), 15);
  if (next15 <= now) next15.setMonth(next15.getMonth() + 1);

  const closing = new Date(y, 11, 31);
  const ago = now <= new Date(y, 5, 30) ? new Date(y, 5, 30) : new Date(y + 1, 5, 30);

  return [
    {
      label: 'TVA — déclaration & paiement',
      detail: 'Mensuel : au plus tard le 15 du mois suivant (réel normal ; le 10 si DGE). Taux normal 18 %.',
      due: next15,
      recurring: 'mensuel' as const,
    },
    {
      label: 'ITS & CNPS (salaires)',
      detail: 'Mensuel : impôts sur traitements et salaires + cotisations CNPS du mois précédent.',
      due: next15,
      recurring: 'mensuel' as const,
    },
    {
      label: "Clôture de l'exercice",
      detail: 'Exercice comptable = année civile (AUDCIF). Inventaire physique et arrêté des comptes.',
      due: closing,
      recurring: 'annuel' as const,
    },
    {
      label: 'États financiers SYSCOHADA + AGO',
      detail: 'Bilan, compte de résultat, tableau des flux de trésorerie et notes annexes, approuvés en AGO dans les 6 mois de la clôture.',
      due: ago,
      recurring: 'annuel' as const,
    },
    {
      label: 'Dépôt DSF (liasse fiscale) à la DGI',
      detail: 'Déclaration Statistique et Fiscale : au plus tard le 30 juin de l’année suivante.',
      due: ago,
      recurring: 'annuel' as const,
    },
  ].sort((a, b) => a.due.getTime() - b.due.getTime());
}

function daysUntil(d: Date, now: Date): number {
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Tableau des flux de trésorerie simplifié (méthode directe)

interface Tx {
  Type: 'income' | 'expense' | 'transfer';
  Category: string;
  Amount: number;
  Status: string;
  ProcessedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  sale: 'Encaissements clients (ventes)',
  expense: 'Paiements fournisseurs & charges',
  adjustment: 'Ajustements de caisse (inventaires)',
  transfer: 'Transferts internes',
  other: 'Autres',
};

export default function FinancialReportsPage() {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/treasury/transactions?status=completed` // bornes appliquées côté client (l'API liste le workspace)
      );
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
      const { data } = await r.json();
      const inYear = (data || []).filter((t: Tx) => {
        const d = new Date(t.ProcessedAt);
        return d.getFullYear() === year;
      });
      setTransactions(inYear);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(fiscalYear); }, [fiscalYear, load]);

  const flux = useMemo(() => {
    const inflows = new Map<string, number>();
    const outflows = new Map<string, number>();
    for (const t of transactions) {
      if (t.Type === 'transfer') continue; // neutre sur la trésorerie globale
      const key = t.Category || 'other';
      const amount = Number(t.Amount || 0);
      if (t.Type === 'income') inflows.set(key, (inflows.get(key) || 0) + amount);
      else if (t.Type === 'expense') outflows.set(key, (outflows.get(key) || 0) + amount);
    }
    const totalIn = [...inflows.values()].reduce((s, v) => s + v, 0);
    const totalOut = [...outflows.values()].reduce((s, v) => s + v, 0);
    return { inflows, outflows, totalIn, totalOut, net: totalIn - totalOut };
  }, [transactions]);

  const deadlines = useMemo(() => buildDeadlines(now), [now]);

  const statements = [
    {
      href: '/accounting/reports/balance-sheet',
      icon: <Landmark className="w-6 h-6 text-blue-700" />,
      title: 'Bilan (Actif / Passif)',
      detail: 'État de la situation patrimoniale au 31/12 — SYSCOHADA.',
    },
    {
      href: '/accounting/reports/income-statement',
      icon: <TrendingUp className="w-6 h-6 text-emerald-700" />,
      title: 'Compte de Résultat',
      detail: 'Charges (classe 6) et produits (classe 7) de l’exercice.',
    },
    {
      href: '/accounting/reports/trial-balance',
      icon: <Scale className="w-6 h-6 text-amber-700" />,
      title: 'Balance Générale',
      detail: 'Soldes débit/crédit par compte — support de la liasse.',
    },
  ];

  return (
    <ProtectedPage permission={PERMISSIONS.REPORTS_VIEW}>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Tableau de bord
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-7 h-7 text-amber-700" /> Rapports Financiers
            </h1>
            <p className="text-muted-foreground">
              États réglementaires SYSCOHADA (Côte d'Ivoire) et échéances légales
            </p>
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

        {/* Échéancier réglementaire */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-amber-700" />
              Échéances réglementaires (périodicité légale)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y">
              {deadlines.map((d, i) => {
                const days = daysUntil(d.due, now);
                const urgent = days <= 10;
                return (
                  <li key={i} className="py-2.5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {d.label}
                        <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] uppercase font-bold">
                          {d.recurring}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{d.detail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold whitespace-nowrap">
                        {d.due.toLocaleDateString('fr-FR')}
                      </p>
                      <p className={'text-xs font-semibold ' + (urgent ? 'text-red-600' : 'text-gray-500')}>
                        {days >= 0 ? `J−${days}` : `dépassée de ${-days} j`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* États financiers SYSCOHADA */}
        <div>
          <h2 className="text-xs uppercase font-semibold text-gray-500 tracking-wide mb-2">
            États financiers annuels — SYSCOHADA (Système Normal)
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {statements.map(s => (
              <Link key={s.href} href={s.href} className="block">
                <Card className="h-full cursor-pointer hover:shadow-md transition">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-1.5">{s.icon}
                      <p className="font-semibold">{s.title}</p>
                    </div>
                    <p className="text-xs text-gray-500">{s.detail}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            Les Notes annexes (4ᵉ état obligatoire) sont un document narratif à
            rédiger par le comptable à partir de ces états.
          </p>
        </div>

        {/* Tableau des flux de trésorerie — méthode directe */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <WalletCards className="w-5 h-5 text-amber-700" />
              Tableau des flux de trésorerie {fiscalYear} (simplifié, méthode directe)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="text-center py-10"><Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-700" /></div>
            ) : error ? (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            ) : transactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Aucun mouvement de trésorerie sur l'exercice {fiscalYear}.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                    <ArrowDownCircle className="w-3.5 h-3.5" /> Encaissements
                  </p>
                  <table className="w-full text-sm">
                    <tbody>
                      {[...flux.inflows.entries()].sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
                        <tr key={cat} className="border-b last:border-b-0">
                          <td className="py-1.5">{CATEGORY_LABELS[cat] || cat}</td>
                          <td className="py-1.5 text-right tabular-nums text-emerald-700">+{fmt(v)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="py-1.5">Total encaissements</td>
                        <td className="py-1.5 text-right tabular-nums text-emerald-700">+{fmt(flux.totalIn)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold text-red-700 mb-1 flex items-center gap-1">
                    <ArrowUpCircle className="w-3.5 h-3.5" /> Décaissements
                  </p>
                  <table className="w-full text-sm">
                    <tbody>
                      {[...flux.outflows.entries()].sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
                        <tr key={cat} className="border-b last:border-b-0">
                          <td className="py-1.5">{CATEGORY_LABELS[cat] || cat}</td>
                          <td className="py-1.5 text-right tabular-nums text-red-700">−{fmt(v)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className="py-1.5">Total décaissements</td>
                        <td className="py-1.5 text-right tabular-nums text-red-700">−{fmt(flux.totalOut)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className={'flex items-center justify-between px-4 py-3 rounded-xl border ' +
                  (flux.net >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
                  <span className="font-semibold">Variation nette de trésorerie {fiscalYear}</span>
                  <span className={'text-xl font-bold tabular-nums ' + (flux.net >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {flux.net >= 0 ? '+' : '−'}{fmt(Math.abs(flux.net))} XOF
                  </span>
                </div>
                <p className="text-xs text-gray-500 italic">
                  Méthode directe à partir des transactions de trésorerie
                  (transferts internes neutralisés). Le TFT complet SYSCOHADA
                  (activités opérationnelles / investissement / financement)
                  se prépare à partir de cette base et de la balance.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedPage>
  );
}
