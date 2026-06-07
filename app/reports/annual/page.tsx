'use client';

/**
 * Page - Rapport Annuel de Pilotage (PCA)
 * Bilan moral & financier d'une année effective : synthèse, tableau
 * mensuel (production · coût · CA · dépenses · marge), stands,
 * vendeurs, produits rentables, RH/paie, charges patronales et dettes.
 * Imprimable tel quel (bouton Imprimer / PDF du navigateur).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer, FileBarChart } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n) || 0));
const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="break-inside-avoid">
      <CardContent className="pt-4">
        <h2 className="font-bold text-amber-900 border-b border-amber-200 pb-1.5 mb-3">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5">
      <p className="text-[11px] text-gray-500 font-medium uppercase">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export default function AnnualReportPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/reports/annual?year=${y}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur de chargement');
      setData((await r.json()).data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(year); }, [year, load]);

  const d = data;

  return (
    <ProtectedPage permission={PERMISSIONS.REPORTS_VIEW}>
      <div className="container mx-auto p-4 sm:p-6 max-w-3xl space-y-4 print:p-0 print:max-w-none">
        <div className="flex items-end justify-between gap-3 flex-wrap print:hidden">
          <div>
            <Link href="/reports" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Rapports
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <FileBarChart className="w-7 h-7 text-amber-700" /> Rapport Annuel
            </h1>
            <p className="text-muted-foreground text-sm">Bilan moral & financier — pilotage d'une année effective</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-semibold">
              {Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold hover:bg-amber-800">
              <Printer className="w-4 h-4" /> Imprimer / PDF
            </button>
          </div>
        </div>

        {/* En-tête imprimé */}
        <div className="hidden print:block border-b-2 border-amber-800 pb-2">
          <h1 className="text-xl font-bold">RAPPORT ANNUEL D'ACTIVITÉ — {year}</h1>
          <p className="text-sm text-gray-600">Bilan moral & financier · Dune de Miel · généré le {new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        {loading ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : d && (
          <>
            {/* ===== Synthèse exécutive ===== */}
            <Section title={`Synthèse exécutive ${d.year}`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Kpi label="Chiffre d'affaires" value={`${fmt(d.sales.ca)} F`} sub={`${fmt(d.sales.count)} ventes`} />
                <Kpi label="Dépenses payées" value={`${fmt(d.expenses.total)} F`} />
                <Kpi label="Marge brute" value={`${fmt(d.result.grossMargin)} F`}
                  sub={d.sales.ca > 0 ? `${Math.round((d.result.grossMargin / d.sales.ca) * 100)} % du CA` : undefined} />
                <Kpi label="Panier moyen" value={`${fmt(d.sales.avgBasket)} F`} />
                <Kpi label="Clients identifiés" value={fmt(d.sales.clients)} sub="hors ventes comptoir" />
                <Kpi label="Effectif actif" value={fmt(d.hr.actifs)} sub={`${d.hr.embauches} embauche(s) dans l'année`} />
              </div>
            </Section>

            {/* ===== Tableau mensuel ===== */}
            <Section title="Tableau de bord mensuel">
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="text-[10px] sm:text-xs uppercase text-gray-500">
                    <tr className="border-b">
                      <th className="text-left py-1.5">Mois</th>
                      <th className="text-right py-1.5">Production</th>
                      <th className="text-right py-1.5">Coût prod.</th>
                      <th className="text-right py-1.5">CA</th>
                      <th className="text-right py-1.5">Dépenses</th>
                      <th className="text-right py-1.5">Salaires versés</th>
                      <th className="text-right py-1.5">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {d.monthly.map((m: any) => (
                      <tr key={m.month} className="border-b last:border-b-0">
                        <td className="py-1.5 font-medium">{MONTHS[m.month - 1]}</td>
                        <td className="py-1.5 text-right">{m.productionQty ? fmt(m.productionQty) : '—'}</td>
                        <td className="py-1.5 text-right">{m.productionCost ? fmt(m.productionCost) : '—'}</td>
                        <td className="py-1.5 text-right font-semibold">{fmt(m.ca)}</td>
                        <td className="py-1.5 text-right">{fmt(m.expenses)}</td>
                        <td className="py-1.5 text-right">{m.salairesNets ? fmt(m.salairesNets) : '—'}</td>
                        <td className={`py-1.5 text-right font-semibold ${m.margin < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                          {fmt(m.margin)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-amber-50 font-bold">
                      <td className="py-2">TOTAL</td>
                      <td className="py-2 text-right">{fmt(d.production.producedQty)}</td>
                      <td className="py-2 text-right">{fmt(d.production.productionCost)}</td>
                      <td className="py-2 text-right">{fmt(d.sales.ca)}</td>
                      <td className="py-2 text-right">{fmt(d.expenses.total)}</td>
                      <td className="py-2 text-right">{fmt(d.hr.netsVerses)}</td>
                      <td className={`py-2 text-right ${d.result.grossMargin < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {fmt(d.result.grossMargin)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ===== Stands & vendeurs ===== */}
            <Section title="Performance des stands">
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  {d.byOutlet.map((o: any) => (
                    <tr key={o.name} className="border-b last:border-b-0">
                      <td className="py-1.5">{o.name}</td>
                      <td className="py-1.5 text-right text-gray-500">{fmt(o.sales)} ventes</td>
                      <td className="py-1.5 text-right font-semibold w-32">{fmt(o.ca)} F</td>
                      <td className="py-1.5 text-right text-gray-500 w-16">
                        {d.sales.ca > 0 ? Math.round((o.ca / d.sales.ca) * 100) : 0} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Performance des vendeurs">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-1.5">Vendeur</th>
                    <th className="text-right py-1.5">Jours</th>
                    <th className="text-right py-1.5">Ventes</th>
                    <th className="text-right py-1.5">CA</th>
                    <th className="text-right py-1.5">Primes reçues</th>
                  </tr>
                </thead>
                <tbody>
                  {d.bySeller.map((v: any) => (
                    <tr key={v.name} className="border-b last:border-b-0">
                      <td className="py-1.5 font-medium">{v.name}</td>
                      <td className="py-1.5 text-right">{v.days || '—'}</td>
                      <td className="py-1.5 text-right">{fmt(v.sales)}</td>
                      <td className="py-1.5 text-right font-semibold">{fmt(v.ca)} F</td>
                      <td className="py-1.5 text-right">{fmt(v.primes)} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* ===== Produits rentables ===== */}
            <Section title="Produits les plus rentables">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-1.5">Produit</th>
                    <th className="text-right py-1.5">Unités</th>
                    <th className="text-right py-1.5">CA</th>
                    <th className="text-right py-1.5">Marge estimée</th>
                  </tr>
                </thead>
                <tbody>
                  {d.topProducts.map((p: any) => (
                    <tr key={p.name} className="border-b last:border-b-0">
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5 text-right">{fmt(p.qty)}</td>
                      <td className="py-1.5 text-right font-semibold">{fmt(p.ca)} F</td>
                      <td className="py-1.5 text-right">
                        {p.margin !== null ? `${fmt(p.margin)} F (${p.marginRate} %)` : 'n.d.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-1.5">Marge estimée sur le coût de revient en stock (n.d. si coût non renseigné).</p>
            </Section>

            {/* ===== RH & paie ===== */}
            <Section title="Ressources humaines & paie">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                <Kpi label="Effectif actif" value={fmt(d.hr.actifs)} />
                <Kpi label="Embauches" value={fmt(d.hr.embauches)} />
                <Kpi label="Bulletins émis" value={fmt(d.hr.bulletins)} />
                <Kpi label="Masse salariale brute" value={`${fmt(d.hr.masseBrute)} F`} />
                <Kpi label="Nets versés" value={`${fmt(d.hr.netsVerses)} F`}
                  sub={d.hr.salairesRestants > 0 ? `reste dû : ${fmt(d.hr.salairesRestants)} F` : 'soldés'} />
                <Kpi label="Primes terrain" value={`${fmt(d.hr.primesTerrain)} F`}
                  sub={`transport ${fmt(d.hr.primesTransport)} · vente ${fmt(d.hr.primesVente)}`} />
              </div>
            </Section>

            {/* ===== Charges patronales & dettes ===== */}
            <Section title="Charges patronales — payées et restantes">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-1.5">Organisme</th>
                    <th className="text-right py-1.5">Dû</th>
                    <th className="text-right py-1.5">Réglé</th>
                    <th className="text-right py-1.5">Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {d.charges.items.map((c: any) => (
                    <tr key={c.organism} className="border-b last:border-b-0">
                      <td className="py-1.5 font-medium">{c.organism}</td>
                      <td className="py-1.5 text-right">{fmt(c.due)} F</td>
                      <td className="py-1.5 text-right text-emerald-700">{fmt(c.paid)} F</td>
                      <td className={`py-1.5 text-right font-semibold ${c.remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {c.remaining > 0 ? `${fmt(c.remaining)} F` : 'Soldé'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(d.charges.totalRemaining > 0 || d.hr.salairesRestants > 0) && (
                <div className="mt-3 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-800">
                  <strong>Dettes en cours :</strong>{' '}
                  {d.charges.totalRemaining > 0 && `${fmt(d.charges.totalRemaining)} F d'organismes sociaux/fiscaux`}
                  {d.charges.totalRemaining > 0 && d.hr.salairesRestants > 0 && ' · '}
                  {d.hr.salairesRestants > 0 && `${fmt(d.hr.salairesRestants)} F de salaires à verser`}
                </div>
              )}
            </Section>

            {/* ===== Dépenses & matières premières ===== */}
            <Section title="Dépenses par catégorie">
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  {d.expenses.list.map((e: any) => (
                    <tr key={e.category} className="border-b last:border-b-0">
                      <td className="py-1.5">{e.category}</td>
                      <td className="py-1.5 text-right text-gray-500">{e.count}×</td>
                      <td className="py-1.5 text-right font-semibold w-32">{fmt(e.total)} F</td>
                      <td className="py-1.5 text-right text-gray-500 w-16">
                        {d.expenses.total > 0 ? Math.round((e.total / d.expenses.total) * 100) : 0} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Production & matières premières">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Kpi label="MP reçues" value={`${fmt(d.production.mpQty)} kg`} sub={`${fmt(d.production.mpCost)} F`} />
                <Kpi label="Ordres terminés" value={fmt(d.production.orders)} />
                <Kpi label="Quantité produite" value={fmt(d.production.producedQty)} />
                <Kpi label="Coût de production" value={`${fmt(d.production.productionCost)} F`} />
              </div>
            </Section>

            <p className="text-xs text-gray-400 text-center pb-6 print:pb-0">
              Rapport généré le {new Date(d.generatedAt).toLocaleString('fr-FR')} — données opérationnelles DDM ·
              document de pilotage interne, à rapprocher des états financiers OHADA pour les usages légaux.
            </p>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
