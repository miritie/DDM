'use client';

/**
 * Page - Simulation du jeu de données (admin)
 * Lance la simulation d'activité jan 2020 → aujourd'hui directement
 * depuis le navigateur : la purge puis chaque année s'exécutent côté
 * serveur (API) en étapes successives, avec journal de progression.
 *
 * ⚠️  DESTRUCTIF : exige de taper SIMULER avant de lancer.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, PlayCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

interface LogLine { text: string; kind: 'info' | 'ok' | 'warn' | 'error' }

export default function SimulateDemoPage() {
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [summary, setSummary] = useState<Array<{ year: number; ca: number; sales: number }>>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const log = (text: string, kind: LogLine['kind'] = 'info') => {
    setLogs(prev => [...prev, { text, kind }]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }), 50);
  };

  async function call(step: string, year?: number) {
    const r = await fetch('/api/admin/simulate-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'SIMULER', step, year }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `Échec étape ${step}`);
    return body.data;
  }

  async function run() {
    if (confirmText !== 'SIMULER' || running) return;
    setRunning(true);
    setDone(false);
    setLogs([]);
    setSummary([]);
    try {
      log('🧹 Étape 1/3 — Purge des données opérationnelles + référentiels…');
      const prep = await call('prepare');
      log(`✅ Purge OK — ${prep.outlets} stand(s), ${prep.products} produit(s). FATOU et les managers sont en place.`, 'ok');
      for (const w of prep.warnings || []) log(`⚠️ ${w}`, 'warn');

      const years: number[] = prep.years || [];
      for (let i = 0; i < years.length; i++) {
        const y = years[i];
        log(`📈 Étape 2/3 — Année ${y} (${i + 1}/${years.length})…`);
        const res = await call('year', y);
        log(`✅ ${y} : ${res.sales} ventes · CA ${fmt(res.ca)} XOF · ${res.entries} écritures · ${res.expenses} dépenses`, 'ok');
      }

      log('📦 Étape 3/3 — Stocks finaux + résumé…');
      const fin = await call('finalize');
      log(`✅ ${fin.stockItems} lignes de stock · ${fmt(fin.entries)} écritures · ${fmt(fin.transactions)} transactions au total`, 'ok');
      setSummary(fin.summary || []);
      setDone(true);
      log('🎉 Simulation terminée — les tableaux de bord, journaux et rapports sont alimentés.', 'ok');
    } catch (e: any) {
      log(`❌ ${e.message} — vous pouvez relancer, la simulation repart de zéro proprement.`, 'error');
    } finally {
      setRunning(false);
      setConfirmText('');
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.ADMIN_SETTINGS_EDIT}>
      <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-4">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Administration
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <PlayCircle className="w-7 h-7 text-amber-700" /> Simulation de Données
          </h1>
          <p className="text-muted-foreground text-sm">
            Jeu de données complet janvier 2020 → aujourd'hui : ventes (Carine, Anicet, Fatou),
            dépenses, impôts, production, écritures comptables, stocks.
          </p>
        </div>

        <div className="flex items-start gap-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>Opération destructive</strong> : toutes les ventes, dépenses, transactions et
            écritures actuelles seront <strong>remplacées</strong>. Les produits, stands,
            utilisateurs et le plan comptable sont conservés.
          </span>
        </div>

        <Card>
          <CardContent className="pt-5 space-y-3">
            <label className="text-sm font-semibold text-gray-700 block">
              Tapez <span className="font-mono text-red-700">SIMULER</span> pour confirmer
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              placeholder="SIMULER"
              disabled={running}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono tracking-widest"
            />
            <button
              onClick={run}
              disabled={confirmText !== 'SIMULER' || running}
              className="w-full py-3 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {running
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Simulation en cours… ne pas fermer la page</>
                : 'Lancer la simulation complète'}
            </button>
          </CardContent>
        </Card>

        {logs.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div ref={logRef} className="max-h-72 overflow-y-auto space-y-1.5 text-sm font-mono">
                {logs.map((l, i) => (
                  <p key={i} className={
                    l.kind === 'ok' ? 'text-emerald-700' :
                    l.kind === 'warn' ? 'text-amber-700' :
                    l.kind === 'error' ? 'text-red-700 font-semibold' : 'text-gray-700'
                  }>{l.text}</p>
                ))}
                {running && <p className="text-gray-400 animate-pulse">…</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {done && summary.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h2 className="font-bold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Chiffre d'affaires simulé
              </h2>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-1.5">Année</th>
                    <th className="text-right py-1.5">Ventes</th>
                    <th className="text-right py-1.5">CA (XOF)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(s => (
                    <tr key={s.year} className="border-b last:border-b-0">
                      <td className="py-1.5 font-semibold">{s.year}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(s.sales)}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{fmt(s.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedPage>
  );
}
