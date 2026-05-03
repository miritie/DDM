'use client';

/**
 * Activation mensuelle des points de vente
 *
 * Pour un mois choisi, le manager voit la liste de tous les outlets et peut :
 *   - cocher / décocher leur activation pour le mois
 *   - définir si la période est payante + montant des frais
 *   - tout enregistrer en lot via /api/outlets/activation
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Save, PowerSquare, CheckCircle } from 'lucide-react';

interface OutletActivation {
  id: string; code: string; name: string; city?: string;
  period: null | {
    id: string; startDate: string; endDate: string;
    isActive: boolean; isPaid: boolean; feeAmount: number; feePeriod: string;
  };
}

interface Draft {
  outletId: string; isActive: boolean; isPaid: boolean; feeAmount: number;
}

export default function ActivationPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [outlets, setOutlets] = useState<OutletActivation[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => { void load(); }, [year, month]);

  async function load() {
    setLoading(true); setFeedback(null);
    try {
      const r = await fetch(`/api/outlets/activation?year=${year}&month=${month}`);
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      const { data } = await r.json();
      setOutlets(data.outlets);
      // Initialise les drafts à partir de la période actuelle (ou défauts)
      const d: Record<string, Draft> = {};
      for (const o of data.outlets) {
        d[o.id] = {
          outletId: o.id,
          isActive: o.period?.isActive ?? true,
          isPaid:   o.period?.isPaid   ?? false,
          feeAmount: Number(o.period?.feeAmount ?? 0),
        };
      }
      setDrafts(d);
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally { setLoading(false); }
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function saveAll() {
    setSaving(true); setFeedback(null);
    try {
      const activations = Object.values(drafts);
      const r = await fetch('/api/outlets/activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodYear: year, periodMonth: month, activations }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur');
      const { data } = await r.json();
      setFeedback(`✅ ${data.count} période${data.count > 1 ? 's' : ''} enregistrée${data.count > 1 ? 's' : ''}`);
      await load();
    } catch (e: any) {
      setFeedback(`❌ ${e.message}`);
    } finally { setSaving(false); }
  }

  function shiftMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const totalActive = Object.values(drafts).filter(d => d.isActive).length;
  const totalFees = Object.values(drafts).filter(d => d.isActive && d.isPaid).reduce((s, d) => s + d.feeAmount, 0);

  return (
    <ProtectedPage permission={PERMISSIONS.OUTLET_VIEW}>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Link href="/admin/outlets" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour aux outlets
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PowerSquare className="w-7 h-7 text-amber-600" />
            Activation mensuelle
          </h1>
          <Button onClick={saveAll} disabled={saving || loading}>
            <Save className="w-4 h-4 mr-1" />{saving ? 'Enregistrement…' : 'Enregistrer le mois'}
          </Button>
        </div>

        <p className="text-sm text-gray-600">
          Pour chaque mois, déclarez quels points de vente sont actifs et leurs frais. Cela génère une période
          d'activité (<code>outlet_periods</code>) pour le mois et synchronise le statut <code>actif/inactif</code> de l'outlet.
        </p>

        {/* Sélecteur mois */}
        <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border">
          <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center font-semibold text-lg capitalize">{monthLabel}</div>
          <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setMonth(today.getMonth() + 1); setYear(today.getFullYear()); }}>
            Mois actuel
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KPI label="Outlets actifs" value={`${totalActive} / ${outlets.length}`} color="emerald" />
          <KPI label="Total frais mensuels" value={`${totalFees.toLocaleString('fr-FR')} XOF`} color="amber" />
          <KPI label="Outlets gratuits" value={String(Object.values(drafts).filter(d => d.isActive && !d.isPaid).length)} color="blue" />
        </div>

        {feedback && (
          <div className={`px-4 py-2 rounded-md text-sm ${feedback.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {feedback}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2">Point de vente</th>
                  <th className="text-center px-3 py-2 w-24">Actif</th>
                  <th className="text-center px-3 py-2 w-24">Payant</th>
                  <th className="text-right px-3 py-2 w-40">Frais mensuels (XOF)</th>
                  <th className="text-center px-3 py-2 w-32">Statut actuel</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {outlets.map(o => {
                  const d = drafts[o.id];
                  if (!d) return null;
                  return (
                    <tr key={o.id} className={!d.isActive ? 'bg-red-50/40' : ''}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{o.name}</div>
                        {o.city && <div className="text-xs text-gray-500">{o.city}</div>}
                      </td>
                      <td className="text-center px-3 py-2">
                        <input type="checkbox" checked={d.isActive}
                          onChange={e => update(o.id, { isActive: e.target.checked })}
                          className="w-5 h-5 accent-emerald-600 cursor-pointer" />
                      </td>
                      <td className="text-center px-3 py-2">
                        <input type="checkbox" checked={d.isPaid} disabled={!d.isActive}
                          onChange={e => update(o.id, { isPaid: e.target.checked })}
                          className="w-5 h-5 accent-amber-600 cursor-pointer disabled:opacity-30" />
                      </td>
                      <td className="text-right px-3 py-2">
                        <input type="number" min={0} value={d.feeAmount} disabled={!d.isPaid || !d.isActive}
                          onChange={e => update(o.id, { feeAmount: Number(e.target.value) || 0 })}
                          className="w-32 px-2 py-1 border rounded-md text-right disabled:bg-gray-100" />
                      </td>
                      <td className="text-center px-3 py-2 text-xs">
                        {o.period ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                            o.period.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                          }`}>
                            {o.period.isActive && <CheckCircle className="w-3 h-3" />}
                            {o.period.isActive ? 'Actif' : 'Inactif'}
                            {o.period.isPaid && ` · ${Number(o.period.feeAmount).toLocaleString('fr-FR')} XOF`}
                          </span>
                        ) : (
                          <span className="text-gray-400">— jamais activé pour ce mois —</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color: string }) {
  const palette: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
  };
  return (
    <div className={`p-3 rounded-xl border-2 ${palette[color]}`}>
      <div className="text-xs uppercase font-semibold">{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}</div>
    </div>
  );
}
