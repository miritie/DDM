'use client';

/**
 * Page - Nouvelle Paie (bulletin individuel)
 * Sélection de l'employé (salaire de base pré-rempli), période,
 * primes/indemnités/déductions → création en brouillon.
 * (Le bouton « Nouvelle Paie » de /hr/payroll pointait vers un 404.)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, BadgeDollarSign } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

interface EmployeeOpt {
  Id: string;
  FullName: string;
  Position?: string;
  BaseSalary?: number;
  Status?: string;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function NewPayrollPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [baseSalary, setBaseSalary] = useState('');
  const [allowances, setAllowances] = useState('0');
  const [bonuses, setBonuses] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hr/employees?status=active')
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erreur de chargement des employés');
        const list = ((await r.json()).data || []) as EmployeeOpt[];
        setEmployees(list);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Pré-remplir le salaire de base à la sélection de l'employé
  useEffect(() => {
    const emp = employees.find(e => e.Id === employeeId);
    if (emp) setBaseSalary(String(Number(emp.BaseSalary || 0)));
  }, [employeeId, employees]);

  const netSalary = useMemo(() =>
    (Number(baseSalary) || 0) + (Number(allowances) || 0) + (Number(bonuses) || 0) - (Number(deductions) || 0),
    [baseSalary, allowances, bonuses, deductions]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) { setError('Sélectionnez un employé'); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/hr/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          period,
          baseSalary: Number(baseSalary) || 0,
          allowances: Number(allowances) || 0,
          bonuses: Number(bonuses) || 0,
          deductions: Number(deductions) || 0,
          notes: notes.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur lors de la création');
      router.push('/hr/payroll');
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.HR_CREATE}>
      <div className="container mx-auto p-6 max-w-xl space-y-4">
        <div>
          <Link href="/hr/payroll" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Gestion de la paie
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BadgeDollarSign className="w-7 h-7 text-amber-700" /> Nouvelle Paie
          </h1>
          <p className="text-muted-foreground">Bulletin individuel — créé en brouillon, à valider puis payer</p>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : (
          <Card>
            <CardContent className="pt-5">
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Employé *</label>
                  <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="">— Choisir —</option>
                    {employees.map(emp => (
                      <option key={emp.Id} value={emp.Id}>
                        {emp.FullName}{emp.Position ? ` — ${emp.Position}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Période *</label>
                    <input type="month" value={period} onChange={e => setPeriod(e.target.value)} required
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Salaire de base (XOF) *</label>
                    <input type="number" min="0" step="1" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} required
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Indemnités</label>
                    <input type="number" min="0" step="1" value={allowances} onChange={e => setAllowances(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Primes</label>
                    <input type="number" min="0" step="1" value={bonuses} onChange={e => setBonuses(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Déductions</label>
                    <input type="number" min="0" step="1" value={deductions} onChange={e => setDeductions(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none" />
                </div>

                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-amber-900">Salaire net</span>
                  <span className="text-xl font-bold text-amber-900 tabular-nums">{fmt(netSalary)} F</span>
                </div>

                {error && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
                )}

                <button type="submit" disabled={saving}
                  className="w-full py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</> : 'Créer le bulletin (brouillon)'}
                </button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedPage>
  );
}
