'use client';

/**
 * Admin — Reporting outlets : journal + P&L par stand.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';

interface Outlet { id: string; Name: string; Code: string }
interface Pnl { salesTotal: number; invoicesTotal: number; invoicesPaid: number; net: number; isSelfFinanced: boolean }
interface JournalSummary {
  period: { from: string; to: string };
  totals: { count: number; total: number; paid: number };
  bySeller: Array<{ userId: string; name: string; salesCount: number; total: number }>;
  sales: Array<{ id: string; sale_number: string; sale_date: string; client_name: string; total_amount: string; sales_person_name: string }>;
}

export default function OutletsReportingPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [journal, setJournal] = useState<JournalSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);

  useEffect(() => {
    fetch('/api/outlets?isActive=true').then(r => r.json()).then(({ data }) => {
      setOutlets(data || []);
      if (data?.length) setActiveId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/outlets/${activeId}/pnl?from=${from}&to=${to}`).then(r => r.json()),
      fetch(`/api/outlets/${activeId}/journal?from=${from}&to=${to}`).then(r => r.json()),
    ]).then(([pnlRes, jRes]) => {
      setPnl(pnlRes.data);
      setJournal(jRes.data);
    }).finally(() => setLoading(false));
  }, [activeId, from, to]);

  return (
    <ProtectedPage permission={PERMISSIONS.OUTLET_VIEW}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Link href="/admin/outlets" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour aux outlets
        </Link>

        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-blue-600" />
          Reporting outlets
        </h1>

        {/* Filtres */}
        <div className="bg-white p-4 rounded-2xl border flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-600 block">Outlet</label>
            <select value={activeId || ''} onChange={e => setActiveId(e.target.value)} className="px-3 py-2 border rounded-md min-w-[200px]">
              {outlets.map(o => <option key={o.id} value={o.id}>{o.Name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block">Du</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 border rounded-md" />
          </div>
          <div>
            <label className="text-xs text-gray-600 block">Au</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 border rounded-md" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : (
          <>
            {/* P&L */}
            {pnl && (
              <div className={`p-6 rounded-2xl border-2 ${pnl.isSelfFinanced ? 'bg-emerald-50 border-emerald-300' : 'bg-orange-50 border-orange-300'}`}>
                <div className="flex items-center gap-3 mb-3">
                  {pnl.isSelfFinanced
                    ? <TrendingUp className="w-8 h-8 text-emerald-600" />
                    : <TrendingDown className="w-8 h-8 text-orange-600" />}
                  <div>
                    <h2 className="font-bold text-xl">
                      {pnl.isSelfFinanced ? 'Outlet auto-financé' : 'Outlet déficitaire'}
                    </h2>
                    <p className="text-sm text-gray-600">Ventes − factures sur la période</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-white p-3 rounded">
                    <p className="text-xs text-gray-500">Ventes</p>
                    <p className="text-lg font-bold">{Number(pnl.salesTotal).toLocaleString('fr-FR')} XOF</p>
                  </div>
                  <div className="bg-white p-3 rounded">
                    <p className="text-xs text-gray-500">Factures émises</p>
                    <p className="text-lg font-bold">{Number(pnl.invoicesTotal).toLocaleString('fr-FR')} XOF</p>
                  </div>
                  <div className="bg-white p-3 rounded">
                    <p className="text-xs text-gray-500">Factures payées</p>
                    <p className="text-lg font-bold">{Number(pnl.invoicesPaid).toLocaleString('fr-FR')} XOF</p>
                  </div>
                  <div className="bg-white p-3 rounded">
                    <p className="text-xs text-gray-500">Solde</p>
                    <p className={`text-lg font-bold ${pnl.net >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                      {pnl.net >= 0 ? '+' : ''}{Number(pnl.net).toLocaleString('fr-FR')} XOF
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Performance par commercial */}
            {journal?.bySeller && journal.bySeller.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border">
                <h2 className="font-bold text-lg mb-3">Performance par commercial</h2>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr><th className="text-left px-3 py-2">Commercial</th><th className="text-right px-3 py-2">Nb ventes</th><th className="text-right px-3 py-2">CA</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {journal.bySeller.map(s => (
                      <tr key={s.userId}>
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2 text-right">{s.salesCount}</td>
                        <td className="px-3 py-2 text-right font-bold">{Number(s.total).toLocaleString('fr-FR')} XOF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Journal détaillé */}
            {journal && (
              <div className="bg-white p-6 rounded-2xl border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-lg">Journal de caisse</h2>
                  <p className="text-sm text-gray-500">{journal.totals.count} ventes • {Number(journal.totals.total).toLocaleString('fr-FR')} XOF</p>
                </div>
                {journal.sales.length === 0 ? (
                  <p className="text-center py-6 text-gray-500 text-sm">Aucune vente sur la période</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2">N°</th>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Client</th>
                        <th className="text-left px-3 py-2">Commercial</th>
                        <th className="text-right px-3 py-2">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {journal.sales.map(s => (
                        <tr key={s.id}>
                          <td className="px-3 py-2 font-mono text-xs">{s.sale_number}</td>
                          <td className="px-3 py-2">{new Date(s.sale_date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-3 py-2">{s.client_name || '—'}</td>
                          <td className="px-3 py-2">{s.sales_person_name}</td>
                          <td className="px-3 py-2 text-right font-bold">{Number(s.total_amount).toLocaleString('fr-FR')} XOF</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
