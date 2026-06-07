'use client';

/**
 * Page - Pointages (Présences)
 * Liste des pointages avec filtre par date, accès au pointage du jour.
 * (Les liens depuis /hr et le dashboard manager pointaient vers un 404.)
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Clock, LogIn } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

interface Attendance {
  AttendanceId: string;
  EmployeeId: string;
  EmployeeName?: string;
  CheckInTime?: string;
  CheckOutTime?: string;
  Status?: string;
  AttendanceDate?: string;
  Date?: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtTime = (d?: string) =>
  d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

export default function AttendancePage() {
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<Attendance[]>([]);
  const [posRows, setPosRows] = useState<any[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    setError(null);
    try {
      const [aRes, eRes, posRes] = await Promise.allSettled([
        fetch(`/api/hr/attendance?startDate=${day}&endDate=${day}`),
        fetch('/api/hr/employees'),
        fetch(`/api/hr/attendance/pos-presence?date=${day}`),
      ]);
      if (posRes.status === 'fulfilled' && posRes.value.ok) {
        setPosRows(((await posRes.value.json()).data || []));
      } else {
        setPosRows([]);
      }
      if (aRes.status !== 'fulfilled' || !aRes.value.ok) {
        const body = aRes.status === 'fulfilled' ? await aRes.value.json().catch(() => ({})) : {};
        throw new Error((body as any).error || 'Erreur de chargement');
      }
      setRows((await aRes.value.json()).data || []);
      if (eRes.status === 'fulfilled' && eRes.value.ok) {
        const m = new Map<string, string>();
        for (const e of ((await eRes.value.json()).data || [])) {
          const name = e.FullName || [e.FirstName, e.LastName].filter(Boolean).join(' ') || e.EmployeeNumber;
          m.set(e.EmployeeId, name);
          if (e.Id || e.id) m.set(e.Id || e.id, name);
        }
        setEmployeeNames(m);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(date); }, [date, load]);

  return (
    <ProtectedPage permission={PERMISSIONS.HR_VIEW}>
      <div className="container mx-auto p-6 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <Link href="/hr" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Ressources Humaines
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Clock className="w-7 h-7 text-amber-700" /> Pointages
            </h1>
            <p className="text-muted-foreground">{rows.length} pointage(s) le {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR')}</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
            <Link href="/hr/attendance/check-in"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800">
              <LogIn className="w-4 h-4" /> Pointer
            </Link>
          </div>
        </div>

        {!loading && posRows.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h2 className="font-bold text-sm mb-2 text-emerald-800">
                Commerciaux — présence automatique (POS)
              </h2>
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-2">Commercial</th>
                    <th className="text-left py-2">Stand</th>
                    <th className="text-center py-2 w-20">Arrivée</th>
                    <th className="text-center py-2 w-20">Départ</th>
                    <th className="text-right py-2 w-28">Ventes</th>
                    <th className="text-center py-2 w-24">Transport</th>
                  </tr>
                </thead>
                <tbody>
                  {posRows.map((r, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="py-2 font-medium">{r.SellerName}</td>
                      <td className="py-2 text-gray-600">{r.OutletName}</td>
                      <td className="py-2 text-center tabular-nums">{fmtTime(r.FirstIn)}</td>
                      <td className="py-2 text-center tabular-nums">{r.LastOut ? fmtTime(r.LastOut) : 'En poste'}</td>
                      <td className="py-2 text-right tabular-nums">
                        {new Intl.NumberFormat('fr-FR').format(Math.round(r.Revenue || 0))} F
                      </td>
                      <td className="py-2 text-center">
                        {r.TransportPaid
                          ? <span className="text-emerald-700 text-xs font-semibold">✓ versée</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-gray-500">
              Aucun pointage manuel à cette date (les commerciaux sont suivis automatiquement via le POS, ci-dessus).
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr className="border-b">
                    <th className="text-left py-2">Employé</th>
                    <th className="text-center py-2 w-28">Arrivée</th>
                    <th className="text-center py-2 w-28">Départ</th>
                    <th className="text-center py-2 w-32">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => (
                    <tr key={a.AttendanceId} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-2.5">
                        {a.EmployeeName || employeeNames.get(a.EmployeeId) || a.EmployeeId}
                      </td>
                      <td className="py-2.5 text-center tabular-nums">{fmtTime(a.CheckInTime)}</td>
                      <td className="py-2.5 text-center tabular-nums">{fmtTime(a.CheckOutTime)}</td>
                      <td className="py-2.5 text-center">
                        <span className={'px-2 py-0.5 rounded-full text-xs font-semibold ' +
                          (a.CheckOutTime ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700')}>
                          {a.CheckOutTime ? 'Journée terminée' : a.CheckInTime ? 'Présent' : (a.Status || '—')}
                        </span>
                      </td>
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
