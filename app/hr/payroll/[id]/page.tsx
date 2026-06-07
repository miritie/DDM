'use client';

/**
 * Page - Détail d'une Paie
 * Bulletin individuel : montants, statut, et actions du cycle de vie
 * (brouillon → valider → payer ; annulation tant que non payée).
 * (Le bouton « Voir » de /hr/payroll pointait vers un 404.)
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, BadgeDollarSign, CheckCircle2, Banknote, XCircle } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-700' },
  validated: { label: 'Validée', cls: 'bg-blue-50 text-blue-700' },
  paid: { label: 'Payée', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Annulée', cls: 'bg-red-50 text-red-700' },
};

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'cash', label: 'Espèces' },
  { value: 'mobile_money', label: 'Mobile Money' },
];

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [payroll, setPayroll] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/payroll/${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Paie introuvable');
      setPayroll((await r.json()).data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function action(fn: () => Promise<Response>) {
    setActing(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) throw new Error((await r.json()).error || "Échec de l'opération");
      setShowPay(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  }

  const validate = () => action(() => fetch(`/api/hr/payroll/${id}/validate`, { method: 'POST' }));
  const pay = () => action(() => fetch(`/api/hr/payroll/${id}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentDate, paymentMethod }),
  }));
  const cancel = () => action(() => fetch(`/api/hr/payroll/${id}`, { method: 'DELETE' }));

  const meta = payroll ? (STATUS_META[payroll.Status] || STATUS_META.draft) : null;

  return (
    <ProtectedPage permission={PERMISSIONS.HR_VIEW}>
      <div className="container mx-auto p-6 max-w-xl space-y-4">
        <div>
          <Link href="/hr/payroll" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-4 h-4" /> Gestion de la paie
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BadgeDollarSign className="w-7 h-7 text-amber-700" /> {payroll?.PayrollNumber || 'Paie'}
          </h1>
          {payroll && (
            <p className="text-muted-foreground">
              {payroll.EmployeeName || payroll.EmployeeId} · {payroll.Period}{' '}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta!.cls}`}>{meta!.label}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : payroll && (
          <>
            <Card>
              <CardContent className="pt-4">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ['Salaire de base', payroll.BaseSalary],
                      ['Indemnités', payroll.Allowances],
                      ['Primes', payroll.Bonuses],
                      ['Déductions', -payroll.Deductions],
                      ['Avances déduites', -payroll.AdvanceDeduction],
                    ].map(([label, val]) => (
                      <tr key={label as string} className="border-b last:border-b-0">
                        <td className="py-2 text-gray-600">{label}</td>
                        <td className={`py-2 text-right tabular-nums font-medium ${Number(val) < 0 ? 'text-red-700' : ''}`}>
                          {fmt(Number(val))} F
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-amber-50">
                      <td className="py-2.5 font-bold text-amber-900">Salaire net</td>
                      <td className="py-2.5 text-right tabular-nums font-bold text-amber-900">{fmt(payroll.NetSalary)} F</td>
                    </tr>
                  </tbody>
                </table>
                {payroll.PaymentDate && (
                  <p className="text-xs text-gray-500 mt-2">
                    Payée le {new Date(payroll.PaymentDate).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {payroll.Notes && <p className="text-sm text-gray-600 mt-2">{payroll.Notes}</p>}
              </CardContent>
            </Card>

            <div className="space-y-2">
              {payroll.Status === 'draft' && (
                <button onClick={validate} disabled={acting}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Valider la paie
                </button>
              )}
              {payroll.Status === 'validated' && !showPay && (
                <button onClick={() => setShowPay(true)} disabled={acting}
                  className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  <Banknote className="w-4 h-4" /> Payer
                </button>
              )}
              {showPay && payroll.Status === 'validated' && (
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Date de paiement</label>
                        <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Moyen de paiement</label>
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={pay} disabled={acting}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50">
                      {acting ? 'Paiement…' : `Confirmer le paiement de ${fmt(payroll.NetSalary)} F`}
                    </button>
                  </CardContent>
                </Card>
              )}
              {(payroll.Status === 'draft' || payroll.Status === 'validated') && (
                <button onClick={cancel} disabled={acting}
                  className="w-full py-2.5 rounded-xl border border-red-300 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  <XCircle className="w-4 h-4" /> Annuler cette paie
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
