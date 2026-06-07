'use client';

/**
 * Page - Nouvel Employé
 * Fiche RH complète : identité, état civil (→ parts fiscales),
 * contrat & rémunération, social (CNPS/CMU), études.
 * (Le bouton « Nouvel employé » de /hr/employees pointait vers un 404.)
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { EmployeeForm, EMPTY_EMPLOYEE, toEmployeePayload, EmployeeFormValues } from '@/components/hr/employee-form';

export default function NewEmployeePage() {
  const router = useRouter();
  const [values, setValues] = useState<EmployeeFormValues>(EMPTY_EMPLOYEE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toEmployeePayload(values)),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur lors de la création');
      router.push('/hr/employees');
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <ProtectedPage permission={PERMISSIONS.HR_CREATE}>
      <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-4">
        <div>
          <Link href="/hr/employees" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Employés
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-amber-700" /> Nouvel Employé
          </h1>
          <p className="text-muted-foreground text-sm">
            Toutes les informations nécessaires au calcul correct du bulletin de paie
          </p>
        </div>

        <EmployeeForm
          values={values}
          onChange={setValues}
          onSubmit={submit}
          saving={saving}
          error={error}
          submitLabel="Créer l'employé"
        />
      </div>
    </ProtectedPage>
  );
}
