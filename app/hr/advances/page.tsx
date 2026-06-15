'use client';

/**
 * Page - Avances au personnel (dette interne) — mobile-first.
 * Octroyer une avance (versée depuis une caisse) ; la récupération se
 * fait automatiquement sur le prochain bulletin de l'employé.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, HandCoins, Plus } from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

export default function StaffAdvancesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, eRes, wRes] = await Promise.allSettled([
        fetch('/api/hr/advances'),
        fetch('/api/hr/employees?status=active'),
        fetch('/api/treasury/wallets?isActive=true'),
      ]);
      if (aRes.status === 'fulfilled' && aRes.value.ok) setRows((await aRes.value.json()).data || []);
      if (eRes.status === 'fulfilled' && eRes.value.ok) setEmployees((await eRes.value.json()).data || []);
      if (wRes.status === 'fulfilled' && wRes.value.ok) setWallets((await wRes.value.json()).data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/hr/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, walletId, amount: Number(amount), reason: reason.trim() || undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Échec de l'octroi");
      setShowForm(false);
      setEmployeeId(''); setWalletId(''); setAmount(''); setReason('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const totalOutstanding = rows.reduce((s, r) => s + (r.Outstanding || 0), 0);

  return (
    <ProtectedPage permission={PERMISSIONS.HR_VIEW}>
      <div className="container mx-auto p-4 sm:p-6 max-w-2xl space-y-4">
        <div className="flex items-end justify-between gap-2 flex-wrap">
          <div>
            <Link href="/hr/payroll" className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Gestion de la paie
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <HandCoins className="w-7 h-7 text-amber-700" /> Avances au personnel
            </h1>
            <p className="text-muted-foreground text-sm">
              Récupérées automatiquement sur le prochain bulletin
            </p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold hover:bg-amber-800">
            <Plus className="w-4 h-4" /> Octroyer
          </button>
        </div>

        {totalOutstanding > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-amber-900">
            Encours total à récupérer : {fmt(totalOutstanding)} F
          </div>
        )}

        {showForm && (
          <Card>
            <CardContent className="pt-5">
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Employé *</label>
                  <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="">— Choisir —</option>
                    {employees.map((emp: any) => (
                      <option key={emp.Id} value={emp.Id}>{emp.FullName}{emp.Position ? ` — ${emp.Position}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Montant (F) *</label>
                    <input type="number" min="1" step="500" value={amount} onChange={e => setAmount(e.target.value)} required
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Versée depuis *</label>
                    <select value={walletId} onChange={e => setWalletId(e.target.value)} required
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                      <option value="">— Caisse / banque —</option>
                      {wallets.map((w: any) => (
                        <option key={w.WalletId || w.Id} value={w.WalletId || w.Id}>{w.Name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Motif</label>
                  <input value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Avance sur salaire, urgence…" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                </div>
                {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
                <button type="submit" disabled={saving}
                  className="w-full py-3 rounded-xl bg-amber-700 text-white font-bold hover:bg-amber-800 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Versement…</> : "Octroyer et verser l'avance"}
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-700" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-gray-500">Aucune avance.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {rows.map(a => (
              <div key={a.id} className="bg-white border-2 border-gray-100 rounded-2xl p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{a.EmployeeName}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {a.AdvanceNumber} · {new Date(a.GrantedAt).toLocaleDateString('fr-FR')}
                    {a.Reason ? ` · ${a.Reason}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{fmt(a.Amount)} F</p>
                  <p className={`text-[11px] font-semibold ${a.Outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {a.Outstanding > 0 ? `reste ${fmt(a.Outstanding)} F` : 'récupérée'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
