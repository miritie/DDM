'use client';

/**
 * Page - Dossier des États Financiers Annuels (SYSCOHADA, Système Normal)
 *
 * Prépare et génère le PDF complet de l'exercice : page de garde, bilan,
 * compte de résultat, TFT simplifié, balance, livre-journal, grand livre
 * et squelette de notes annexes — le dossier à remettre à
 * l'expert-comptable / CGA pour visa avant dépôt de la DSF à la DGI
 * (au plus tard le 30 juin).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, FileDown, FileSpreadsheet, ShieldAlert,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadFinancialStatementsPdf } from '@/lib/pdf/financial-statements-pdf';
import { loadReceiptLogo } from '@/lib/pdf/sale-receipt-pdf';
import type { FinancialStatements } from '@/lib/modules/accounting/financial-statements-service';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

export default function FinancialStatementsPage() {
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [data, setData] = useState<FinancialStatements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/accounting/reports/financial-statements?fiscalYear=${year}`);
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur de chargement');
      setData((await r.json()).data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(fiscalYear); }, [fiscalYear, load]);

  async function handlePdf() {
    if (!data) return;
    setGenerating(true);
    setMessage(null);
    try {
      const logo = await loadReceiptLogo(data.company.logoUrl);
      downloadFinancialStatementsPdf(data, logo);
      setMessage(`Dossier états-financiers-${fiscalYear}.pdf téléchargé ✓`);
    } catch (e: any) {
      setMessage('Erreur : ' + e.message);
    } finally {
      setGenerating(false);
    }
  }

  const balanced = data
    ? Math.abs(
        data.trialBalance.reduce((s, r) => s + r.debit, 0) -
        data.trialBalance.reduce((s, r) => s + r.credit, 0)
      ) < 0.02
    : false;
  const hasEntries = (data?.journal.length || 0) > 0;

  const sections = data ? [
    { label: 'Bilan (Actif / Passif)', detail: `${data.bilan.actif.length + data.bilan.passif.length} poste(s) — total ${fmt(data.bilan.totalActif)} ${data.company.currency}` },
    { label: 'Compte de résultat', detail: `${data.resultat.resultat >= 0 ? 'Bénéfice' : 'Perte'} de ${fmt(Math.abs(data.resultat.resultat))} ${data.company.currency}` },
    { label: 'Tableau des flux de trésorerie (simplifié)', detail: `Variation nette ${data.tft.net >= 0 ? '+' : '−'}${fmt(Math.abs(data.tft.net))} ${data.company.currency}` },
    { label: 'Balance générale', detail: `${data.trialBalance.length} compte(s) mouvementé(s)${balanced ? ' — équilibrée ✓' : ' — ⚠ déséquilibre'}` },
    { label: 'Livre-journal', detail: `${data.journal.length} écriture(s) comptabilisée(s)` },
    { label: 'Grand livre (synthèse)', detail: `${data.ledger.length} compte(s)` },
    { label: 'Notes annexes (squelette)', detail: '10 notes pré-structurées, chiffres clés pré-remplis — à compléter' },
  ] : [];

  return (
    <ProtectedPage permission={PERMISSIONS.REPORTS_VIEW}>
      <div className="container mx-auto p-6 space-y-4 max-w-3xl">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link href="/accounting" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Comptabilité
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-7 h-7 text-amber-700" /> États Financiers Annuels
            </h1>
            <p className="text-muted-foreground">
              Dossier SYSCOHADA complet (PDF) — à faire viser par l'expert-comptable / CGA
            </p>
          </div>
          <label className="text-sm text-gray-600 inline-flex items-center gap-2">
            Exercice
            <select value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
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
        ) : data && (
          <>
            {/* Contenu du dossier */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Contenu du dossier {fiscalYear}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="divide-y">
                  {sections.map((s, i) => (
                    <li key={i} className="py-2.5 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{i + 1}. {s.label}</p>
                        <p className="text-xs text-gray-500">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {!hasEntries && (
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Aucune écriture comptabilisée sur l'exercice {fiscalYear} — le dossier
                  sera vide. Les écritures de ventes et de dépenses se génèrent
                  automatiquement ; vérifiez l'exercice sélectionné.
                </span>
              </div>
            )}

            {/* Avertissement réglementaire */}
            <div className="flex items-start gap-2.5 text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
              <ShieldAlert className="w-5 h-5 text-stone-500 mt-0.5 shrink-0" />
              <p>
                Ce dossier est <strong>préparatoire</strong> : il rassemble toute la matière
                comptable de l'exercice au format SYSCOHADA. Pour le dépôt officiel de la
                <strong> DSF</strong> à la DGI (au plus tard le <strong>30 juin {fiscalYear + 1}</strong>),
                il doit être revu, complété (notes annexes, retraitements, amortissements)
                et <strong>visé par un expert-comptable inscrit à l'Ordre ou un CGA</strong>.
              </p>
            </div>

            {message && (
              <div className="text-sm text-center text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                {message}
              </div>
            )}

            <button
              onClick={handlePdf}
              disabled={generating || !hasEntries}
              className="w-full py-3.5 rounded-xl bg-amber-700 text-white font-bold text-base hover:bg-amber-800 active:scale-[0.99] transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Génération…</>
                : <><FileDown className="w-5 h-5" /> Télécharger le dossier PDF {fiscalYear}</>}
            </button>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
