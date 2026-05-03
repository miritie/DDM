'use client';

/**
 * Admin — Planning hebdomadaire des commerciaux par outlet
 *
 * Matrice : ligne = outlet, colonne = jour de la semaine.
 * Affiche l'agent assigné par semaine (assignment) et les exceptions ad-hoc (override).
 * Bouton "Imprimer programme" pour la version PDF/print.
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, Printer, Plus, X } from 'lucide-react';

interface Outlet { id: string; code: string; name: string; city?: string }
interface Agent { id: string; username: string; full_name: string }
interface Assignment { id: string; outlet_id: string; user_id: string; week_start: string; week_end: string; user_name: string; outlet_name: string; notes?: string }
interface Override { id: string; outlet_id: string; user_id: string; date_from: string; date_to: string; user_name: string; outlet_name: string; reason?: string }

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function startOfWeek(d: Date): Date {
  const day = d.getDay() || 7;
  const r = new Date(d);
  r.setDate(d.getDate() - (day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

export default function PlanningPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [scope, setScope] = useState<'week' | 'month'>('week');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ outletId: string; date: string } | null>(null);

  const range = useMemo(() => {
    if (scope === 'week') {
      return { from: isoDate(weekStart), to: isoDate(addDays(weekStart, 6)) };
    }
    const month = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const next = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0);
    return { from: isoDate(month), to: isoDate(next) };
  }, [weekStart, scope]);

  useEffect(() => { void load(); }, [range.from, range.to]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/outlets/planning?from=${range.from}&to=${range.to}`);
      if (r.ok) {
        const { data } = await r.json();
        setOutlets(data.outlets); setAgents(data.agents);
        setAssignments(data.assignments); setOverrides(data.overrides);
      }
    } finally { setLoading(false); }
  }

  // Pour une cellule (outletId, date), renvoie l'agent affecté (override > assignment)
  function whoIsHere(outletId: string, date: string): { agent: Agent | null; source: 'override' | 'assignment' | null } {
    const ov = overrides.find(o => o.outlet_id === outletId && o.date_from <= date && o.date_to >= date);
    if (ov) {
      return { agent: agents.find(a => a.id === ov.user_id) || null, source: 'override' };
    }
    const a = assignments.find(x => x.outlet_id === outletId && x.week_start <= date && x.week_end >= date);
    if (a) return { agent: agents.find(ag => ag.id === a.user_id) || null, source: 'assignment' };
    return { agent: null, source: null };
  }

  async function assign(outletId: string, agentId: string, kind: 'week' | 'override') {
    if (kind === 'week') {
      const s = startOfWeek(new Date(editing!.date));
      await fetch('/api/outlets/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId, userId: agentId,
          weekStart: isoDate(s), weekEnd: isoDate(addDays(s, 6)),
        }),
      });
    } else {
      await fetch('/api/outlets/assignment-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outletId, userId: agentId,
          dateFrom: editing!.date, dateTo: editing!.date,
          reason: 'Affectation ponctuelle',
        }),
      });
    }
    setEditing(null);
    await load();
  }

  const days: Date[] = [];
  if (scope === 'week') {
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
  } else {
    const month = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    const next = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0);
    for (let d = new Date(month); d <= next; d = addDays(d, 1)) days.push(new Date(d));
  }

  const printUrl = `/admin/outlets/planning/print?from=${range.from}&to=${range.to}&scope=${scope}`;

  return (
    <ProtectedPage permission={PERMISSIONS.OUTLET_VIEW}>
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Link href="/admin/outlets" className="inline-flex items-center text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour aux outlets
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-bold">Planning des commerciaux</h1>
          <a href={printUrl} target="_blank" rel="noreferrer">
            <Button variant="outline"><Printer className="w-4 h-4 mr-1" /> Imprimer programme</Button>
          </a>
        </div>

        {/* Sélecteur période */}
        <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, scope === 'week' ? -7 : -30))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center font-semibold">
            {scope === 'week'
              ? `Semaine du ${range.from} au ${range.to}`
              : `${new Date(range.from).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`}
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addDays(weekStart, scope === 'week' ? 7 : 30))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="ml-3 inline-flex rounded-md border overflow-hidden">
            <button onClick={() => setScope('week')} className={`px-3 py-1.5 text-sm ${scope === 'week' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Semaine</button>
            <button onClick={() => setScope('month')} className={`px-3 py-1.5 text-sm ${scope === 'month' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Mois</button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Aujourd'hui</Button>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>
        ) : outlets.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border text-center text-gray-500">Aucun outlet actif.</div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-gray-50 z-10">Outlet</th>
                  {days.map(d => (
                    <th key={d.toISOString()} className="text-center px-2 py-2 min-w-[90px] border-l">
                      <div className="text-xs text-gray-500">{DAY_NAMES[(d.getDay() || 7) - 1]}</div>
                      <div className="font-bold">{d.getDate()}/{String(d.getMonth() + 1).padStart(2, '0')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outlets.map(o => (
                  <tr key={o.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r font-medium">{o.name}</td>
                    {days.map(d => {
                      const date = isoDate(d);
                      const { agent, source } = whoIsHere(o.id, date);
                      return (
                        <td key={date} className="px-2 py-2 border-l text-center">
                          {agent ? (
                            <button
                              onClick={() => setEditing({ outletId: o.id, date })}
                              className={`inline-block w-full px-2 py-1 rounded text-xs font-medium ${
                                source === 'override' ? 'bg-orange-100 text-orange-800 border border-orange-300' : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                              title={source === 'override' ? 'Exception ponctuelle' : 'Planning hebdo'}
                            >
                              {agent.full_name.split(' ')[0]}
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditing({ outletId: o.id, date })}
                              className="inline-flex items-center justify-center w-full h-7 rounded border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-gray-500 flex gap-4">
          <span><span className="inline-block w-3 h-3 bg-blue-50 border border-blue-200 rounded mr-1" /> Planning hebdo</span>
          <span><span className="inline-block w-3 h-3 bg-orange-100 border border-orange-300 rounded mr-1" /> Exception ponctuelle</span>
        </div>

        {/* Modal d'affectation */}
        {editing && (
          <AssignModal
            outlet={outlets.find(o => o.id === editing.outletId)!}
            date={editing.date}
            agents={agents}
            current={whoIsHere(editing.outletId, editing.date).agent}
            onClose={() => setEditing(null)}
            onAssign={(agentId, kind) => assign(editing.outletId, agentId, kind)}
          />
        )}
      </div>
    </ProtectedPage>
  );
}

function AssignModal({ outlet, date, agents, current, onClose, onAssign }: {
  outlet: Outlet; date: string; agents: Agent[]; current: Agent | null;
  onClose: () => void; onAssign: (agentId: string, kind: 'week' | 'override') => void;
}) {
  const [agentId, setAgentId] = useState(current?.id || (agents[0]?.id ?? ''));
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{outlet.name}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        {current && <p className="text-sm bg-blue-50 px-3 py-2 rounded mb-3">Actuellement : <strong>{current.full_name}</strong></p>}
        <label className="text-xs text-gray-600 block mb-1">Agent commercial</label>
        <select value={agentId} onChange={e => setAgentId(e.target.value)} className="w-full px-3 py-2 border rounded-md mb-4">
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        <div className="flex gap-2 flex-col sm:flex-row">
          <Button onClick={() => onAssign(agentId, 'week')} className="flex-1">Affecter pour la semaine</Button>
          <Button variant="outline" onClick={() => onAssign(agentId, 'override')} className="flex-1">Affecter ce jour seulement</Button>
        </div>
      </div>
    </div>
  );
}
