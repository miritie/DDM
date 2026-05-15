'use client';

/**
 * Panel "Paiement de la dépense" — réutilisable depuis :
 *   - app/production/purchase-requests/[id]/page.tsx (sollicitation achat MP)
 *   - app/expenses/requests/[id]/page.tsx (sollicitation dépense)
 *
 * Comportement selon le statut de la dépense liée :
 *   - Sollicitation pas encore approuvée → aucune dépense créée → message d'attente
 *   - Dépense `pending` → en cours d'approbation
 *   - Dépense `approved`  → formulaire multi-wallet (visible aux utilisateurs avec EXPENSE_PAY)
 *   - Dépense `paid`      → récap des transactions wallet liées
 *   - Dépense `rejected`  → notification courte
 *
 * Le composant fait son propre fetch via /api/expenses/by-request/[requestId]
 * et /api/expenses/[id]/pay (GET pour les transactions, POST pour payer).
 */

import { useEffect, useState } from 'react';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2, Plus, Trash2, CheckCircle2, AlertCircle, Clock, BookOpen, CalendarClock } from 'lucide-react';
import { cachedFetch, invalidateCache } from '@/lib/client/cached-fetch';

interface ExpenseLite {
  id: string;
  expense_id: string;
  expense_number: string;
  title: string;
  amount: number | string;
  status: 'pending' | 'approved' | 'scheduled' | 'paid' | 'rejected';
  payment_date: string | null;
  scheduled_payment_date?: string | null;
  payer_name: string | null;
}

interface PaymentTransaction {
  id: string;
  transaction_id: string;
  transaction_number: string;
  amount: number | string;
  source_wallet_id: string;
  wallet_name: string | null;
  processed_at: string;
  description: string;
  status: string;
  processed_by_name: string | null;
}

interface WalletOption {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface AllocationRow {
  walletId: string;
  amount: number;
}

function formatXof(n: number | string): string {
  const v = Number(n);
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' XOF';
}

interface JournalEntryLite {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  journal_code: string;
  journal_label: string;
  status: string;
  lines: Array<{
    line_number: number;
    label: string;
    account_number: string;
    account_label: string;
    debit_amount: number | string;
    credit_amount: number | string;
  }>;
}

export function ExpensePaymentPanel({ expenseRequestId }: { expenseRequestId: string }) {
  const [expense, setExpense] = useState<ExpenseLite | null>(null);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [journalEntry, setJournalEntry] = useState<JournalEntryLite | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<AllocationRow[]>([{ walletId: '', amount: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState<string>('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/expenses/by-request/${expenseRequestId}`);
      const j = await r.json();
      const exp: ExpenseLite | null = j.data ?? null;
      setExpense(exp);

      if (exp) {
        if (exp.status === 'paid') {
          // Les deux fetch sont indépendants — parallélisation pour gagner
          // un round-trip réseau (impact 3G).
          const [tj, jeJ] = await Promise.all([
            fetch(`/api/expenses/${exp.id}/pay`).then(r => r.json()),
            fetch(`/api/expenses/${exp.id}/journal-entry`).then(r => r.json()),
          ]);
          setPayments(tj.data || []);
          setJournalEntry(jeJ.data ?? null);
        }
        if (exp.status === 'approved' || exp.status === 'scheduled') {
          // Liste wallets cachée 60s (cache shortLived côté HTTP + cache mémoire client).
          // Le solde affiché reste vrai à 1 min près — acceptable pour préparer un paiement.
          const wj = await cachedFetch<{ data: any[] }>('/api/treasury/wallets?isActive=true', { ttl: 60_000 });
          const ws: WalletOption[] = (wj.data || [])
            .map((w: any) => ({
              id: w.Id || w.id,
              name: w.Name || w.name,
              type: w.Type || w.type,
              balance: Number(w.Balance ?? w.balance ?? 0),
            }))
            .filter((w: WalletOption) => w.id);
          setWallets(ws);
          setAllocations([{ walletId: ws[0]?.id || '', amount: Number(exp.amount) }]);
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [expenseRequestId]);

  const total = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const expenseAmount = expense ? Number(expense.amount) : 0;
  const diff = total - expenseAmount;
  const balanced = Math.abs(diff) < 0.01;

  async function submitSchedule() {
    if (!expense) return;
    if (!scheduledDate) {
      setError('Choisis une date prévue de paiement');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/expenses/${expense.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la planification');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment() {
    if (!expense) return;
    if (!balanced) {
      setError(`Le total doit égaler ${formatXof(expenseAmount)} — écart actuel : ${formatXof(Math.abs(diff))}`);
      return;
    }
    if (allocations.some(a => !a.walletId || a.amount <= 0)) {
      setError('Chaque ligne doit avoir un wallet et un montant > 0');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/expenses/${expense.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      // Le paiement a modifié les soldes wallets : on invalide le cache pour
      // que la prochaine lecture refasse un fetch frais.
      invalidateCache('/api/treasury/wallets?isActive=true');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du paiement');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border rounded-xl p-4 flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement du paiement…
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="bg-gray-50 border rounded-xl p-4 text-sm text-gray-600 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Dépense pas encore créée — elle apparaîtra ici dès l'approbation de la sollicitation.
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-amber-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-600" />
            Paiement de la dépense
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {expense.expense_number} · {expense.title}
          </p>
        </div>
        <StatusBadge status={expense.status} />
      </div>

      <div className="flex items-baseline justify-between border-y border-gray-200 py-3">
        <span className="text-sm text-gray-600">Montant à régler</span>
        <span className="text-xl font-bold text-gray-900">{formatXof(expense.amount)}</span>
      </div>

      {expense.status === 'pending' && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          En attente d'approbation par l'admin.
        </p>
      )}

      {expense.status === 'rejected' && (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">
          Dépense rejetée — aucun paiement possible.
        </p>
      )}

      {expense.status === 'paid' && (
        <div className="space-y-3">
          <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Réglé le {expense.payment_date ? new Date(expense.payment_date).toLocaleDateString('fr-FR') : '—'}
            {expense.payer_name && ` par ${expense.payer_name}`}.
          </p>

          {payments.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Mouvements de wallet
              </h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b">
                    <th className="text-left py-1">Wallet</th>
                    <th className="text-left py-1">Réf. transaction</th>
                    <th className="text-right py-1">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-1.5">{p.wallet_name || '—'}</td>
                      <td className="py-1.5 text-xs text-gray-500 font-mono">{p.transaction_number}</td>
                      <td className="py-1.5 text-right font-semibold">{formatXof(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {journalEntry ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Écriture comptable
                </h4>
                <span className="text-xs font-mono text-slate-600">
                  {journalEntry.entry_number} · {journalEntry.journal_label}
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b">
                    <th className="text-left py-1">N°</th>
                    <th className="text-left py-1">Compte</th>
                    <th className="text-left py-1">Libellé</th>
                    <th className="text-right py-1">Débit</th>
                    <th className="text-right py-1">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {journalEntry.lines.map(l => (
                    <tr key={l.line_number} className="border-b border-slate-100 last:border-b-0">
                      <td className="py-1 font-mono text-slate-500">{l.account_number}</td>
                      <td className="py-1">{l.account_label}</td>
                      <td className="py-1 text-slate-600">{l.label}</td>
                      <td className="py-1 text-right font-semibold">{Number(l.debit_amount) > 0 ? formatXof(l.debit_amount) : '—'}</td>
                      <td className="py-1 text-right font-semibold">{Number(l.credit_amount) > 0 ? formatXof(l.credit_amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
              ⚠ Écriture comptable non générée. Vérifier que la catégorie a un compte de charge configuré et que chaque wallet pointe vers un compte de trésorerie.
            </div>
          )}
        </div>
      )}

      {(expense.status === 'approved' || expense.status === 'scheduled') && (
        <Can permission={PERMISSIONS.EXPENSE_PAY} fallback={
          <p className="text-sm text-gray-600 bg-amber-50 rounded-lg p-3">
            {expense.status === 'scheduled'
              ? `Paiement planifié pour le ${expense.scheduled_payment_date ? new Date(expense.scheduled_payment_date).toLocaleDateString('fr-FR') : '—'} — un utilisateur avec la permission "expense:pay" (comptable) exécutera le règlement.`
              : 'Dépense approuvée et prête à être payée — un utilisateur avec la permission "expense:pay" (comptable) doit exécuter le règlement.'}
          </p>
        }>
          <div className="space-y-3">
            {expense.status === 'scheduled' && expense.scheduled_payment_date && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 flex-none" />
                <span>
                  Paiement <strong>planifié</strong> pour le{' '}
                  <strong>{new Date(expense.scheduled_payment_date).toLocaleDateString('fr-FR')}</strong>.
                  Tu peux l'exécuter dès maintenant ou attendre la date prévue.
                </span>
              </div>
            )}

            {expense.status === 'approved' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 block mb-1">Planifier le paiement pour…</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full px-2 py-1.5 border rounded text-sm"
                  />
                </div>
                <Button
                  onClick={submitSchedule}
                  disabled={submitting || !scheduledDate}
                  variant="outline"
                  className="border-blue-400 text-blue-700 hover:bg-blue-50"
                >
                  <CalendarClock className="w-4 h-4 mr-1" /> Planifier
                </Button>
              </div>
            )}
            <p className="text-xs text-gray-600">
              Répartis le montant sur un ou plusieurs wallets. La somme doit égaler exactement {formatXof(expenseAmount)}.
            </p>

            <div className="space-y-2">
              {allocations.map((a, i) => {
                const w = wallets.find(x => x.id === a.walletId);
                const insufficient = w && w.balance < a.amount;
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-7">
                      <select
                        value={a.walletId}
                        onChange={(e) => setAllocations(als => als.map((x, j) => j === i ? { ...x, walletId: e.target.value } : x))}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      >
                        <option value="">Choisir un wallet…</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name} · solde {formatXof(w.balance)}
                          </option>
                        ))}
                      </select>
                      {insufficient && (
                        <p className="text-xs text-red-600 mt-0.5">Solde insuffisant</p>
                      )}
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={a.amount}
                        onChange={(e) => setAllocations(als => als.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))}
                        className="w-full px-2 py-1.5 border rounded text-sm text-right"
                      />
                    </div>
                    <div className="col-span-1 flex items-center pt-1.5">
                      {allocations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAllocations(als => als.filter((_, j) => j !== i))}
                          className="text-gray-400 hover:text-red-600"
                          aria-label="Retirer cette ligne"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setAllocations(als => [...als, { walletId: '', amount: Math.max(0, expenseAmount - total) }])}
                className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Ajouter un wallet
              </button>
            </div>

            <div className="flex items-center justify-between text-sm border-t pt-2">
              <span className="text-gray-600">Total</span>
              <span className={`font-bold ${balanced ? 'text-green-700' : 'text-red-700'}`}>
                {formatXof(total)}
                {!balanced && <span className="text-xs font-normal ml-2">({diff > 0 ? '+' : ''}{formatXof(diff)})</span>}
              </span>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-none mt-0.5" />
                {error}
              </div>
            )}

            <Button
              onClick={submitPayment}
              disabled={submitting || !balanced}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
              {submitting ? 'Paiement en cours…' : expense.status === 'scheduled' ? 'Exécuter le paiement maintenant' : 'Exécuter le paiement'}
            </Button>
          </div>
        </Can>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ExpenseLite['status'] }) {
  const map: Record<ExpenseLite['status'], { label: string; className: string }> = {
    pending:   { label: 'En attente',  className: 'bg-gray-100 text-gray-700' },
    approved:  { label: 'Approuvée',   className: 'bg-amber-100 text-amber-800' },
    scheduled: { label: 'Planifiée',   className: 'bg-blue-100 text-blue-800' },
    paid:      { label: 'Payée',       className: 'bg-green-100 text-green-800' },
    rejected:  { label: 'Rejetée',     className: 'bg-red-100 text-red-700' },
  };
  const m = map[status];
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${m.className}`}>{m.label}</span>;
}
