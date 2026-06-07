'use client';

/**
 * Page - Fiche Employé (consultation + édition)
 * Identité, état civil → parts fiscales, contrat & rémunération,
 * social (CNPS/CMU), études — et accès direct à ses bulletins.
 * (Le bouton « Voir » de /hr/employees pointait vers un 404.)
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, UserRound, BadgeDollarSign } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { EmployeeForm, fromEmployee, toEmployeePayload, EmployeeFormValues, EMPTY_EMPLOYEE } from '@/components/hr/employee-form';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700' },
  inactive: { label: 'Inactif', cls: 'bg-gray-100 text-gray-600' },
  suspended: { label: 'Suspendu', cls: 'bg-amber-50 text-amber-700' },
  terminated: { label: 'Contrat terminé', cls: 'bg-red-50 text-red-700' },
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<any | null>(null);
  const [values, setValues] = useState<EmployeeFormValues>(EMPTY_EMPLOYEE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/employees/${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Employé introuvable');
      const data = (await r.json()).data;
      setEmployee(data);
      setValues(fromEmployee(data));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch(`/api/hr/employees/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toEmployeePayload(values)),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur lors de la mise à jour');
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const status = employee ? (STATUS_LABELS[employee.Status] || STATUS_LABELS.active) : null;

  return (
    <ProtectedPage permission={PERMISSIONS.HR_VIEW}>
      <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-4">
        <div>
          <Link href="/hr/employees" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Employés
          </Link>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <UserRound className="w-7 h-7 text-amber-700" /> {employee?.FullName || 'Employé'}
              </h1>
              {employee && (
                <p className="text-muted-foreground text-sm">
                  {employee.EmployeeCode} · {employee.Position}
                  {status && (
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
                  )}
                </p>
              )}
            </div>
            {employee && (
              <Link
                href={`/hr/payroll?employeeId=${employee.Id || employee.id || ''}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 text-amber-800 text-sm font-semibold hover:bg-amber-50"
              >
                <BadgeDollarSign className="w-4 h-4" /> Ses bulletins
              </Link>
            )}
          </div>
        </div>

        {saved && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            ✅ Fiche mise à jour — les prochains bulletins utiliseront ces paramètres
          </div>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : employee ? (
          <EmployeeForm
            values={values}
            onChange={setValues}
            onSubmit={submit}
            saving={saving}
            error={error}
            submitLabel="Enregistrer la fiche"
          />
        ) : (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error || 'Employé introuvable'}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
