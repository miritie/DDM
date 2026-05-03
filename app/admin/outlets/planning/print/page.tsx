'use client';

/**
 * Vue imprimable du programme prévisionnel.
 * En-tête : nom du workspace + slogan + adresse + tél (configurables dans /admin/workspace).
 *
 * Query params :
 *   - from / to : plage à imprimer (YYYY-MM-DD)
 *   - scope : 'week' | 'month' (informationnel, change juste le titre)
 */

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Printer } from 'lucide-react';

interface Workspace { name: string; slogan?: string; address?: string; phone?: string; email?: string; logo_url?: string }
interface Outlet { id: string; name: string }
interface Assignment { outlet_id: string; user_name: string; week_start: string; week_end: string }
interface Override { outlet_id: string; user_name: string; date_from: string; date_to: string; reason?: string }

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(d.getDate() + n); return r; }

export default function PlanningPrintPage() {
  const params = useSearchParams();
  const from = params.get('from') || isoDate(new Date());
  const to   = params.get('to')   || from;
  const scope = (params.get('scope') as 'week' | 'month') || 'week';

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/workspace').then(r => r.ok ? r.json() : { data: null }),
      fetch(`/api/outlets/planning?from=${from}&to=${to}`).then(r => r.json()),
    ]).then(([ws, pl]) => {
      setWorkspace(ws.data);
      setOutlets(pl.data?.outlets || []);
      setAssignments(pl.data?.assignments || []);
      setOverrides(pl.data?.overrides || []);
    }).finally(() => setLoading(false));
  }, [from, to]);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = new Date(from); d <= new Date(to); d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }, [from, to]);

  function whoIsHere(outletId: string, date: string): { name: string; isOverride: boolean } | null {
    const ov = overrides.find(o => o.outlet_id === outletId && o.date_from <= date && o.date_to >= date);
    if (ov) return { name: ov.user_name, isOverride: true };
    const a = assignments.find(x => x.outlet_id === outletId && x.week_start <= date && x.week_end >= date);
    if (a) return { name: a.user_name, isOverride: false };
    return null;
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;

  const periodLabel = scope === 'week'
    ? `Programme hebdomadaire`
    : `Programme mensuel`;

  return (
    <div className="min-h-screen bg-white p-8 max-w-[1200px] mx-auto">
      {/* Bouton imprimer (caché à l'impression) */}
      <div className="print:hidden mb-4 flex justify-end">
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded inline-flex items-center gap-2">
          <Printer className="w-4 h-4" /> Imprimer / PDF
        </button>
      </div>

      {/* En-tête entreprise */}
      <header className="border-b-2 border-amber-600 pb-4 mb-6 flex items-start justify-between gap-6">
        <div>
          {workspace?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={workspace.logo_url} alt="Logo" className="h-16 mb-2" />
          )}
          <h1 className="text-3xl font-bold text-amber-700">{workspace?.name || 'DUNE DE MIEL'}</h1>
          {workspace?.slogan && <p className="text-sm italic text-gray-600">{workspace.slogan}</p>}
          {workspace?.address && <p className="text-xs text-gray-700 mt-1">{workspace.address}</p>}
          <div className="text-xs text-gray-700 mt-0.5">
            {workspace?.phone && <span>Tél : {workspace.phone}</span>}
            {workspace?.phone && workspace?.email && <span> · </span>}
            {workspace?.email && <span>{workspace.email}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="uppercase text-xs tracking-wide text-gray-500">{periodLabel}</div>
          <div className="text-lg font-bold">{from} → {to}</div>
          <div className="text-xs text-gray-500 mt-1">Édité le {new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </header>

      <h2 className="text-xl font-bold mb-3">Affectations des commerciaux par point de vente</h2>

      {outlets.length === 0 ? (
        <p className="text-gray-500">Aucun point de vente actif.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-amber-50 border-y-2 border-amber-600">
              <th className="text-left p-2 border-r border-amber-200">Point de vente</th>
              {days.map(d => (
                <th key={d.toISOString()} className="text-center p-2 border-r border-amber-200 min-w-[70px]">
                  <div className="text-[10px] uppercase text-gray-600">{DAY_NAMES[(d.getDay() || 7) - 1]}</div>
                  <div className="font-bold">{d.getDate()}/{String(d.getMonth() + 1).padStart(2, '0')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outlets.map((o, idx) => (
              <tr key={o.id} className={idx % 2 ? 'bg-gray-50' : ''}>
                <td className="p-2 border-r border-gray-200 font-medium">{o.name}</td>
                {days.map(d => {
                  const date = isoDate(d);
                  const who = whoIsHere(o.id, date);
                  return (
                    <td key={date} className="p-2 border-r border-gray-200 text-center text-xs">
                      {who ? (
                        <span className={who.isOverride ? 'text-orange-700 font-semibold' : ''}>
                          {who.name.split(' ').slice(0, 2).join(' ')}
                          {who.isOverride && '*'}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-xs text-gray-500 mt-3">* affectation ponctuelle (exception au planning hebdo)</p>

      {/* Pied de page signatures */}
      <footer className="mt-12 grid grid-cols-2 gap-12 text-sm">
        <div>
          <p className="font-semibold mb-12">Le Manager Commercial</p>
          <div className="border-t border-gray-400 pt-1 text-xs text-gray-500">Signature et cachet</div>
        </div>
        <div>
          <p className="font-semibold mb-12">L'Administrateur</p>
          <div className="border-t border-gray-400 pt-1 text-xs text-gray-500">Signature et cachet</div>
        </div>
      </footer>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
