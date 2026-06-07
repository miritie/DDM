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

interface ChargeRow {
  period: string;
  bulletins: number;
  cnps: number;
  its: number;
  fdfp: number;
  total: number;
  dueDate: string;
  settled: boolean;
  settledAt?: string | null;
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

  async function settle(period: string, total: number) {
    if (!window.confirm(`Régler ${fmt(total)} F de charges (CNPS + DGI + FDFP) pour ${period} depuis la banque ?`)) return;
    setSettling(period);
    setError(null);
    setDone(null);
    try {
      const r = await fetch('/api/hr/payroll/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'Échec du règlement');
      setDone(`Charges ${period} réglées : ${fmt(body.data?.total || total)} F versés (CNPS, DGI, FDFP)`);
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
                          Réglées{r.settledAt ? ` le ${new Date(r.settledAt).toLocaleDateString('fr-FR')}` : ''}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${late ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          {late && <AlertTriangle className="w-3.5 h-3.5" />}
                          {late ? 'EN RETARD — ' : ''}Échéance {new Date(r.dueDate + 'T00:00:00').toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-gray-50 rounded-lg py-2">
                        <p className="text-[11px] text-gray-500 font-medium">CNPS</p>
                        <p className="font-bold tabular-nums text-sm">{fmt(r.cnps)} F</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg py-2">
                        <p className="text-[11px] text-gray-500 font-medium">DGI — ITS</p>
                        <p className="font-bold tabular-nums text-sm">{fmt(r.its)} F</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg py-2">
                        <p className="text-[11px] text-gray-500 font-medium">FDFP</p>
                        <p className="font-bold tabular-nums text-sm">{fmt(r.fdfp)} F</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-amber-900 tabular-nums">Total : {fmt(r.total)} F</p>
                      {!r.settled && (
                        <button
                          onClick={() => settle(r.period, r.total)}
                          disabled={settling === r.period}
                          className="px-4 py-2 rounded-xl bg-amber-700 text-white text-sm font-bold hover:bg-amber-800 disabled:opacity-50 inline-flex items-center gap-2"
                        >
                          {settling === r.period
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Règlement…</>
                            : 'Régler depuis la banque'}
                        </button>
                      )}
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
