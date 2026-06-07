'use client';

/**
 * Page - Charges sociales & fiscales de la paie (dettes à régler)
 * Par période payée : CNPS (431), DGI-ITS (442), FDFP (447), avec
 * échéance légale (le 15 du mois suivant) et règlement en un clic
 * depuis la banque — transactions + écritures d'extinction de dette.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Landmark, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

interface OrganismRow {
  organism: 'CNPS' | 'DGI' | 'FDFP';
  due: number;
  paid: number;
  remaining: number;
  lastPaidAt?: string | null;
}
interface ChargeRow {
  period: string;
  bulletins: number;
  organisms: OrganismRow[];
  total: number;
  totalPaid: number;
  totalRemaining: number;
  dueDate: string;
  settled: boolean;
}

export default function PayrollChargesPage() {
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/hr/payroll/charges');
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur de chargement');
      setRows((await r.json()).data || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Montants saisis pour versements partiels (clé période:organisme)
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  async function settle(period: string, organism: string, remaining: number) {
    const key = `${period}:${organism}`;
    const amount = Number(amounts[key]) || remaining;
    if (!window.confirm(`Verser ${fmt(amount)} F à ${organism} pour ${period} depuis la banque ?` +
      (amount < remaining ? `\n(versement partiel — il restera ${fmt(remaining - amount)} F)` : ''))) return;
    setSettling(key);
    setError(null);
    setDone(null);
    try {
      const r = await fetch('/api/hr/payroll/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, organism, amount }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'Échec du règlement');
      setDone(`${organism} ${period} : ${fmt(body.data.amount)} F versés` +
        (body.data.remaining > 0 ? ` — reste ${fmt(body.data.remaining)} F` : ' — soldé ✅'));
      setAmounts(prev => ({ ...prev, [key]: '' }));
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSettling(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <ProtectedPage permission={PERMISSIONS.HR_VIEW}>
      <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-4">
        <div>
          <Link href="/hr/payroll" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Gestion de la paie
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Landmark className="w-7 h-7 text-amber-700" /> Charges Sociales & Fiscales
          </h1>
          <p className="text-muted-foreground text-sm">
            Dettes générées par les paies payées — à déclarer et régler avant le
            15 du mois suivant (e-CNPS · e-Impôts · e-FDFP)
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}
        {done && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">✅ {done}</div>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              Aucune paie payée pour l'instant — les charges apparaîtront ici après le paiement des bulletins.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map(r => {
              const late = !r.settled && r.dueDate < today;
              return (
                <Card key={r.period} className={late ? 'border-red-300' : r.settled ? 'border-emerald-200' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold text-lg">{r.period}</p>
                        <p className="text-xs text-gray-500">{r.bulletins} bulletin(s) payé(s)</p>
                      </div>
                      {r.settled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Soldées
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${late ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          {late && <AlertTriangle className="w-3.5 h-3.5" />}
                          {late ? 'EN RETARD — ' : ''}Échéance {new Date(r.dueDate + 'T00:00:00').toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mb-3">
                      {r.organisms.map(o => {
                        const key = `${r.period}:${o.organism}`;
                        return (
                          <div key={o.organism} className="bg-gray-50 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div>
                                <p className="text-sm font-semibold">
                                  {o.organism === 'DGI' ? 'DGI — ITS' : o.organism}
                                </p>
                                <p className="text-xs text-gray-500 tabular-nums">
                                  Dû {fmt(o.due)} F · Réglé {fmt(o.paid)} F ·{' '}
                                  <span className={o.remaining > 0 ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                                    {o.remaining > 0 ? `Reste ${fmt(o.remaining)} F` : 'Soldé ✓'}
                                  </span>
                                </p>
                              </div>
                              {o.remaining > 0 && (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number" min="1" max={o.remaining} step="1000"
                                    placeholder={String(o.remaining)}
                                    value={amounts[key] ?? ''}
                                    onChange={e => setAmounts(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-right tabular-nums"
                                  />
                                  <button
                                    onClick={() => settle(r.period, o.organism, o.remaining)}
                                    disabled={settling === key}
                                    className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 disabled:opacity-50"
                                  >
                                    {settling === key ? '…' : 'Verser'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="font-bold text-amber-900 tabular-nums">
                        Total dû : {fmt(r.total)} F
                      </p>
                      <p className="tabular-nums text-gray-600">
                        Réglé {fmt(r.totalPaid)} F · <span className={r.totalRemaining > 0 ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold'}>
                          {r.totalRemaining > 0 ? `Reste ${fmt(r.totalRemaining)} F` : 'Soldé'}
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
