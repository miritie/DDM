'use client';

/**
 * Composant — File de paiement comptable
 *
 * Pendant de ApprovalQueue côté admin. Agrège les dépenses qui attendent
 * une action du comptable :
 *   - 'approved'  : à planifier ou payer
 *   - 'scheduled' : à exécuter (date prévue)
 *
 * Affiché en bandeau au-dessus du dashboard comptable. Si la file est
 * vide, affiche un message rassurant (style ApprovalQueue).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet, CheckCircle, RefreshCw, CalendarClock, ChevronRight, AlertTriangle,
} from 'lucide-react';

interface QueueRow {
  id: string;
  expense_id: string;
  expense_number: string;
  title: string;
  amount: number | string;
  status: 'approved' | 'scheduled';
  scheduled_payment_date: string | null;
  expense_request_slug: string;
  request_number: string;
  category_label: string | null;
  category_code: string | null;
  requester_name: string | null;
}

interface QueueData {
  approved: QueueRow[];
  scheduled: QueueRow[];
  totalCount: number;
  totalAmount: number;
}

const fmt = (n: number | string) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n)) + ' XOF';

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function PaymentQueue() {
  const router = useRouter();
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/dashboard/accountant/payment-queue', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      setData(j.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow border-2 border-emerald-200 p-6">
        <div className="flex items-center gap-2 text-emerald-700">
          <RefreshCw className="w-4 h-4 animate-spin" /> Chargement des dépenses à exécuter…
        </div>
      </div>
    );
  }
  if (error) {
    // user sans EXPENSE_PAY : on n'affiche rien (silencieux)
    return null;
  }
  if (!data || data.totalCount === 0) {
    return (
      <div className="bg-white rounded-2xl shadow border-2 border-green-200 p-6 flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-600" />
        <div>
          <p className="font-semibold text-green-900">Aucune dépense à exécuter</p>
          <p className="text-sm text-green-700">Toutes les sollicitations validées sont déjà réglées.</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-emerald-200">
      <div className="border-b border-emerald-100 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-emerald-700" />
          <div>
            <h2 className="font-bold text-emerald-900">À exécuter</h2>
            <p className="text-xs text-emerald-700/80">
              {data.totalCount} dépense{data.totalCount > 1 ? 's' : ''} validée{data.totalCount > 1 ? 's' : ''} en attente de paiement · {fmt(data.totalAmount)}
            </p>
          </div>
        </div>
        <button onClick={load} className="text-emerald-700 hover:text-emerald-900">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {data.scheduled.length > 0 && (
          <Section title="Planifiées" icon={CalendarClock} accent="text-indigo-700">
            {data.scheduled.map(row => {
              const late = row.scheduled_payment_date && row.scheduled_payment_date < today;
              return (
                <QueueLine
                  key={row.id}
                  row={row}
                  rightLabel={
                    row.scheduled_payment_date ? (
                      <span className={`text-xs ${late ? 'text-red-600 font-semibold' : 'text-indigo-700'}`}>
                        {late && '⚠ '} {fmtDate(row.scheduled_payment_date)}
                      </span>
                    ) : null
                  }
                  onClick={() => router.push(`/expenses/requests/${row.expense_request_slug}`)}
                />
              );
            })}
          </Section>
        )}

        {data.approved.length > 0 && (
          <Section title="À planifier ou payer" icon={AlertTriangle} accent="text-amber-700">
            {data.approved.map(row => (
              <QueueLine
                key={row.id}
                row={row}
                rightLabel={null}
                onClick={() => router.push(`/expenses/requests/${row.expense_request_slug}`)}
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, accent, children }: any) {
  return (
    <div className="px-6 py-3">
      <h3 className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 mb-2 ${accent}`}>
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function QueueLine({ row, rightLabel, onClick }: { row: QueueRow; rightLabel: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate">{row.title}</p>
          {row.category_label && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{row.category_label}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {row.request_number} · {row.requester_name || '—'}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-sm">{fmt(row.amount)}</p>
        {rightLabel}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </button>
  );
}
