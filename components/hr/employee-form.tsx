'use client';

/**
 * Formulaire Employé — partagé entre création et édition.
 * Toutes les variables nécessaires au bulletin de paie CI :
 * état civil (statut matrimonial + enfants → parts fiscales affichées
 * en direct), contrat (type, catégorie, salaire / taux journalier,
 * prime de transport), social (n° CNPS, CMU), études.
 */

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
  maritalStatus: string;
  childrenCount: string;
  contractType: string;
  category: string;
  position: string;
  department: string;
  hireDate: string;
  baseSalary: string;
  dailyRate: string;
  transportDaily: string;
  cnpsNumber: string;
  cnpsSubject: boolean;
  cmuBeneficiaries: string;
  educationLevel: string;
  diploma: string;
}

export const EMPTY_EMPLOYEE: EmployeeFormValues = {
  firstName: '', lastName: '', phone: '', email: '', dateOfBirth: '', address: '',
  maritalStatus: 'celibataire', childrenCount: '0',
  contractType: 'permanent', category: 'employe', position: '', department: '',
  hireDate: new Date().toISOString().slice(0, 10),
  baseSalary: '', dailyRate: '', transportDaily: '2500',
  cnpsNumber: '', cnpsSubject: true, cmuBeneficiaries: '1', educationLevel: '', diploma: '',
};

const MARITAL = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie', label: 'Marié(e)' },
  { value: 'divorce', label: 'Divorcé(e)' },
  { value: 'veuf', label: 'Veuf / Veuve' },
];
const CONTRACTS = [
  { value: 'permanent', label: 'CDI' },
  { value: 'temporary', label: 'CDD / Journalier' },
  { value: 'contractor', label: 'Prestataire' },
  { value: 'intern', label: 'Stagiaire' },
];
const CATEGORIES = [
  { value: 'cadre', label: 'Cadre' },
  { value: 'agent_maitrise', label: 'Agent de maîtrise' },
  { value: 'employe', label: 'Employé' },
  { value: 'ouvrier', label: 'Ouvrier' },
  { value: 'journalier', label: 'Journalier' },
];
const EDUCATION = ['Aucun', 'Primaire', 'Secondaire (BEPC)', 'Bac', 'Bac+2 (BTS/DUT)', 'Licence (Bac+3)', 'Master (Bac+5)', 'Doctorat'];

// Quotient familial CI (miroir de lib/modules/hr/payroll-ci.ts)
function fiscalParts(marital: string, children: number): number {
  const c = Math.max(0, Math.floor(children || 0));
  let base: number;
  if (marital === 'marie') base = 2;
  else if (c > 0) base = marital === 'veuf' ? 2 : 1.5;
  else base = 1;
  return Math.min(base + 0.5 * c, 5);
}

const input = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm';
const select = input + ' bg-white';
const label = 'text-sm font-semibold text-gray-700 block mb-1';

export function EmployeeForm({
  values, onChange, onSubmit, saving, error, submitLabel,
}: {
  values: EmployeeFormValues;
  onChange: (v: EmployeeFormValues) => void;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const v = values;
  const up = (patch: Partial<EmployeeFormValues>) => onChange({ ...v, ...patch });
  const isDaily = v.contractType === 'temporary' || v.category === 'journalier';
  const parts = useMemo(
    () => fiscalParts(v.maritalStatus, Number(v.childrenCount) || 0),
    [v.maritalStatus, v.childrenCount]
  );

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="font-bold">Identité</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Nom *</label>
              <input value={v.lastName} onChange={e => up({ lastName: e.target.value })} required className={input} />
            </div>
            <div>
              <label className={label}>Prénom(s) *</label>
              <input value={v.firstName} onChange={e => up({ firstName: e.target.value })} required className={input} />
            </div>
            <div>
              <label className={label}>Téléphone *</label>
              <input value={v.phone} onChange={e => up({ phone: e.target.value })} required placeholder="+225 07 …" className={input} />
            </div>
            <div>
              <label className={label}>Email</label>
              <input type="email" value={v.email} onChange={e => up({ email: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Date de naissance</label>
              <input type="date" value={v.dateOfBirth} onChange={e => up({ dateOfBirth: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Adresse</label>
              <input value={v.address} onChange={e => up({ address: e.target.value })} className={input} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="font-bold">État civil <span className="text-xs font-normal text-gray-500">— détermine l'impôt (ITS)</span></h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Statut matrimonial *</label>
              <select value={v.maritalStatus} onChange={e => up({ maritalStatus: e.target.value })} className={select}>
                {MARITAL.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Enfants à charge *</label>
              <input type="number" min="0" max="15" value={v.childrenCount}
                onChange={e => up({ childrenCount: e.target.value })} className={input} />
            </div>
          </div>
          <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-900">
            Parts fiscales : <strong>{parts}</strong> — réduction d'impôt (RICF) :{' '}
            <strong>{new Intl.NumberFormat('fr-FR').format(Math.round((parts - 1) * 2) * 5500)} F/mois</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="font-bold">Contrat & rémunération</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Type de contrat *</label>
              <select value={v.contractType} onChange={e => up({ contractType: e.target.value })} className={select}>
                {CONTRACTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Catégorie *</label>
              <select value={v.category} onChange={e => up({ category: e.target.value })} className={select}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Poste / Fonction *</label>
              <input value={v.position} onChange={e => up({ position: e.target.value })} required className={input} />
            </div>
            <div>
              <label className={label}>Département</label>
              <input value={v.department} onChange={e => up({ department: e.target.value })}
                placeholder="Commercial, Production, Finance…" className={input} />
            </div>
            <div>
              <label className={label}>Date d'embauche *</label>
              <input type="date" value={v.hireDate} onChange={e => up({ hireDate: e.target.value })} required className={input} />
            </div>
            <div>
              <label className={label}>Salaire de base mensuel (F) *</label>
              <input type="number" min="0" step="1000" value={v.baseSalary}
                onChange={e => up({ baseSalary: e.target.value })} required className={input} />
            </div>
            {isDaily && (
              <div>
                <label className={label}>Taux journalier (F/jour)</label>
                <input type="number" min="0" step="500" value={v.dailyRate}
                  onChange={e => up({ dailyRate: e.target.value })}
                  placeholder="Salaire = taux × jours travaillés" className={input} />
              </div>
            )}
            <div>
              <label className={label}>Prime de transport (F/jour de présence)</label>
              <input type="number" min="0" step="100" value={v.transportDaily}
                onChange={e => up({ transportDaily: e.target.value })} className={input} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <h2 className="font-bold">Social & études</h2>
          <label className="flex items-start gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={v.cnpsSubject}
              onChange={e => up({ cnpsSubject: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-amber-700" />
            <span className="text-sm">
              <strong>Assujetti à la CNPS</strong> (salarié déclaré)
              <span className="block text-xs text-gray-500">
                Décoché : aucune retenue CNPS/ITS ni charge patronale (CNPS, CMU, FDFP) — le bulletin affichera N/A
              </span>
            </span>
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Matricule CNPS</label>
              <input value={v.cnpsNumber} onChange={e => up({ cnpsNumber: e.target.value })}
                disabled={!v.cnpsSubject}
                placeholder={v.cnpsSubject ? 'À renseigner pour les déclarations' : 'N/A — non assujetti'}
                className={input + (v.cnpsSubject ? '' : ' bg-gray-100 text-gray-400')} />
            </div>
            <div>
              <label className={label}>Bénéficiaires CMU pris en charge</label>
              <input type="number" min="1" max="20" value={v.cmuBeneficiaries}
                onChange={e => up({ cmuBeneficiaries: e.target.value })} className={input} />
            </div>
            <div>
              <label className={label}>Niveau d'étude</label>
              <select value={v.educationLevel} onChange={e => up({ educationLevel: e.target.value })} className={select}>
                <option value="">— Non renseigné —</option>
                {EDUCATION.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Diplôme</label>
              <input value={v.diploma} onChange={e => up({ diploma: e.target.value })}
                placeholder="Ex. BTS Comptabilité" className={input} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <button type="submit" disabled={saving}
        className="w-full py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : submitLabel}
      </button>
    </form>
  );
}

/** Form → payload API (POST /api/hr/employees ou PATCH /[id]). */
export function toEmployeePayload(v: EmployeeFormValues) {
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    phone: v.phone.trim(),
    email: v.email.trim() || undefined,
    dateOfBirth: v.dateOfBirth || undefined,
    address: v.address.trim() || undefined,
    maritalStatus: v.maritalStatus,
    childrenCount: Number(v.childrenCount) || 0,
    contractType: v.contractType,
    category: v.category,
    position: v.position.trim(),
    department: v.department.trim() || undefined,
    hireDate: v.hireDate,
    baseSalary: Number(v.baseSalary) || 0,
    dailyRate: v.dailyRate === '' ? null : Number(v.dailyRate),
    transportDaily: Number(v.transportDaily) || 0,
    cnpsNumber: v.cnpsNumber.trim() || undefined,
    cnpsSubject: v.cnpsSubject,
    cmuBeneficiaries: Number(v.cmuBeneficiaries) || 1,
    educationLevel: v.educationLevel || undefined,
    diploma: v.diploma.trim() || undefined,
  };
}

/** Réponse API (PascalCase) → valeurs du formulaire. */
export function fromEmployee(e: any): EmployeeFormValues {
  return {
    firstName: e.FirstName ?? '',
    lastName: e.LastName ?? '',
    phone: e.Phone ?? '',
    email: e.Email ?? '',
    dateOfBirth: e.DateOfBirth ? String(e.DateOfBirth).slice(0, 10) : '',
    address: e.Address ?? '',
    maritalStatus: e.MaritalStatus ?? 'celibataire',
    childrenCount: String(e.ChildrenCount ?? 0),
    contractType: e.ContractType ?? 'permanent',
    category: e.Category ?? 'employe',
    position: e.Position ?? '',
    department: e.Department ?? '',
    hireDate: e.HireDate ? String(e.HireDate).slice(0, 10) : '',
    baseSalary: String(Number(e.BaseSalary ?? 0)),
    dailyRate: e.DailyRate != null ? String(Number(e.DailyRate)) : '',
    transportDaily: String(Number(e.TransportDaily ?? 2500)),
    cnpsNumber: e.CnpsNumber ?? '',
    cnpsSubject: e.CnpsSubject !== false,
    cmuBeneficiaries: String(e.CmuBeneficiaries ?? 1),
    educationLevel: e.EducationLevel ?? '',
    diploma: e.Diploma ?? '',
  };
}
