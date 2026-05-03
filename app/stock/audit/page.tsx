'use client';

/**
 * Audit valorisation stock — vérifie la cohérence des montants et des quantités.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Calculator } from 'lucide-react';

interface BreakdownLine { location: string; kind: 'warehouse' | 'outlet'; qty: number; unitCost: number; lineValue: number; recomputed: number }
interface ProductAudit {
  product: { id: string; name: string; code: string; sellPrice: number };
  totalQty: number; totalValue: number; recomputedValue: number;
  weightedCost: number; valueMatchesCompute: boolean;
  zeroCostLines: number; negativeLines: number;
  sold: number;
  movements: { in: number; out: number; adjustments: number };
  breakdown: BreakdownLine[];
}
interface Anomaly { severity: 'warning' | 'error'; product: string; message: string }
interface AuditData {
  totals: { totalQty: number; totalValue: number; recomputedValue: number; productsCount: number };
  audit: ProductAudit[];
  anomalies: Anomaly[];
}

export default function StockAuditPage() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [recalcing, setRecalcing] = useState(false);

  function load() {
    setLoading(true);
    fetch('/api/stock/audit').then(r => r.json()).then(d => setData(d.data)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function toggle(id: string) {
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function recalc() {
    if (!confirm('Recalculer les coûts unitaires des lignes à 0 XOF ?')) return;
    setRecalcing(true);
    try {
      const r = await fetch('/api/stock/recalculate-costs', { method: 'POST' });
      const result = await r.json().catch(() => ({} as any));
      if (!r.ok) throw new Error(result?.error || `HTTP ${r.status}`);
      alert(`✅ ${result.data.updated} ligne(s) corrigée(s). Nouvelle valeur : ${Math.round(result.data.newTotalValue).toLocaleString('fr-FR')} XOF`);
      load();
    } catch (e: any) { alert(`❌ ${e.message}`); } finally { setRecalcing(false); }
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;
  if (!data) return <div className="p-6 text-red-600">Erreur de chargement</div>;

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Link href="/stock" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour au stock
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calculator className="w-7 h-7 text-blue-600" /> Audit valorisation
          </h1>
          <button onClick={recalc} disabled={recalcing}
            className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm hover:bg-amber-100 inline-flex items-center gap-2">
            <Calculator className="w-4 h-4" />{recalcing ? 'Recalcul…' : 'Recalculer coûts à 0'}
          </button>
        </div>

        {/* Récap */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Produits actifs" value={String(data.totals.productsCount)} />
          <KPI label="Quantité totale" value={data.totals.totalQty.toLocaleString('fr-FR')} />
          <KPI label="Valeur en base" value={`${Math.round(data.totals.totalValue).toLocaleString('fr-FR')} XOF`} />
          <KPI label="Valeur recalculée" value={`${Math.round(data.totals.recomputedValue).toLocaleString('fr-FR')} XOF`}
               highlight={Math.abs(data.totals.totalValue - data.totals.recomputedValue) > 0.01} />
        </div>

        {/* Anomalies */}
        {data.anomalies.length > 0 ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
            <h2 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> {data.anomalies.length} anomalie{data.anomalies.length > 1 ? 's' : ''} détectée{data.anomalies.length > 1 ? 's' : ''}
            </h2>
            <ul className="space-y-1 text-sm">
              {data.anomalies.map((a, i) => (
                <li key={i} className={a.severity === 'error' ? 'text-red-700' : 'text-amber-800'}>
                  <strong>{a.product}</strong> — {a.message}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-800">
            <CheckCircle className="w-5 h-5" /> Aucune anomalie détectée — toutes les lignes sont valorisées et cohérentes.
          </div>
        )}

        {/* Détail produit */}
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-8"></th>
                <th className="text-left px-3 py-2">Produit</th>
                <th className="text-right px-3 py-2">Qté totale</th>
                <th className="text-right px-3 py-2">Coût moyen pondéré</th>
                <th className="text-right px-3 py-2">Valeur totale</th>
                <th className="text-right px-3 py-2 text-gray-500">Vendus</th>
                <th className="text-center px-3 py-2">État</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.audit.map(a => (
                <>
                  <tr key={a.product.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggle(a.product.id)}>
                    <td className="text-center">{expanded.has(a.product.id) ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{a.product.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{a.product.code} · prix vente {a.product.sellPrice.toLocaleString('fr-FR')} XOF</div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{a.totalQty.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2 text-right">{a.weightedCost.toLocaleString('fr-FR')} XOF</td>
                    <td className="px-3 py-2 text-right font-bold">{Math.round(a.totalValue).toLocaleString('fr-FR')} XOF</td>
                    <td className="px-3 py-2 text-right text-gray-500">{a.sold}</td>
                    <td className="px-3 py-2 text-center">
                      {a.zeroCostLines > 0 || a.negativeLines > 0 || !a.valueMatchesCompute
                        ? <span className="text-amber-600" title="Voir détail">⚠️</span>
                        : <span className="text-emerald-600">✓</span>}
                    </td>
                  </tr>
                  {expanded.has(a.product.id) && (
                    <tr key={a.product.id + '-detail'} className="bg-gray-50">
                      <td></td>
                      <td colSpan={6} className="px-3 py-3">
                        <table className="w-full text-xs">
                          <thead className="text-gray-600">
                            <tr>
                              <th className="text-left">Emplacement</th>
                              <th className="text-right">Qté</th>
                              <th className="text-right">Coût unitaire</th>
                              <th className="text-right">Valeur ligne</th>
                              <th className="text-right">Recalculé</th>
                            </tr>
                          </thead>
                          <tbody>
                            {a.breakdown.length === 0 && (
                              <tr><td colSpan={5} className="text-center py-2 text-gray-400">Aucune ligne stock</td></tr>
                            )}
                            {a.breakdown.map((b, i) => (
                              <tr key={i} className={b.unitCost === 0 ? 'text-amber-700' : ''}>
                                <td className="py-1">
                                  <span className={`px-1.5 py-0.5 rounded mr-1 text-[10px] ${b.kind === 'warehouse' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {b.kind === 'warehouse' ? 'ENT' : 'OUT'}
                                  </span>
                                  {b.location}
                                </td>
                                <td className="text-right py-1">{b.qty}</td>
                                <td className="text-right py-1">{b.unitCost === 0 ? <strong>0 ⚠️</strong> : b.unitCost.toLocaleString('fr-FR')}</td>
                                <td className="text-right py-1">{Math.round(b.lineValue).toLocaleString('fr-FR')}</td>
                                <td className="text-right py-1 text-gray-500">{Math.round(b.recomputed).toLocaleString('fr-FR')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {a.movements && (
                          <p className="text-xs text-gray-500 mt-2">
                            Mouvements validés : <strong>+{a.movements.in}</strong> entrées, <strong>−{a.movements.out}</strong> sorties, <strong>{a.movements.adjustments}</strong> ajustements
                            · <strong>{a.sold}</strong> vendu(s)
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedPage>
  );
}

function KPI({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border-2 ${highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <div className="text-xs uppercase font-semibold text-gray-600">{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${highlight ? 'text-amber-900' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
