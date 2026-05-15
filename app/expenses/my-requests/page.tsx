'use client';

/**
 * Page — "Mes demandes de dépenses"
 *
 * Vue dédiée au demandeur : il voit l'évolution de SES propres demandes
 * dans le workflow (draft → submitted → approved → scheduled → paid).
 * Permet à un acteur qui a sollicité une dépense de suivre où elle en est
 * sans dépendre de la liste globale.
 *
 * Branchement : l'API filtre via ?requesterId=me (alias résolu côté serveur).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, Plus, Zap, Clock, CheckCircle2, XCircle,
  Wallet, CalendarClock, Loader2, AlertTriangle,
} from 'lucide-react';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';

interface MyRequest {
  Id?: string;
  id?: string;
  ExpenseRequestId: string;
  RequestNumber: string;
  Title: string;
  Amount: number | string;
  Status: 'draft' | 'submitted' | 'approved' | 'scheduled' | 'paid' | 'rejected' | 'cancelled';
  CreatedAt: string;
  CategoryLabel?: string;
}

const STATUS_STEPS: Array<{ key: string; label: string; icon: any }> = [
  { key: 'draft',     label: 'Brouillon',  icon: FileText },
  { key: 'submitted', label: 'Soumise',    icon: Clock },
  { key: 'approved',  label: 'Approuvée',  icon: CheckCircle2 },
  { key: 'scheduled', label: 'Planifiée',  icon: CalendarClock },
  { key: 'paid',      label: 'Payée',      icon: Wallet },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-600 bg-gray-100',
  submitted: 'text-amber-700 bg-amber-100',
  approved: 'text-blue-700 bg-blue-100',
  scheduled: 'text-indigo-700 bg-indigo-100',
  paid: 'text-green-700 bg-green-100',
  rejected: 'text-red-700 bg-red-100',
  cancelled: 'text-gray-500 bg-gray-100',
};

function fmtXof(n: number | string): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n)) + ' XOF';
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StepIndicator({ status }: { status: MyRequest['Status'] }) {
  // Pour rejected / cancelled : on n'affiche que l'état terminal en rouge/gris
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[status]}`}>
        <XCircle className="w-3 h-3" />
        {status === 'rejected' ? 'Rejetée' : 'Annulée'}
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => {
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
                reached
                  ? (isCurrent ? STATUS_COLORS[step.key] + ' ring-2 ring-offset-1 ring-current' : 'bg-green-100 text-green-700')
                  : 'bg-gray-50 text-gray-300'
              }`}
              title={step.label}
            >
              <Icon className="w-3 h-3" />
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`w-3 h-px ${reached ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Content() {
  const router = useRouter();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/expenses/requests?requesterId=me')
      .then((r) => r.ok ? r.json() : { data: [], error: 'fetch failed' })
      .then((j) => {
        if (j.error) setError(j.error);
        setRequests(j.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/80 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-7 h-7" /> Mes demandes de dépenses
            </h1>
            <Link href="/expenses/requests/quick">
              <Button className="bg-white text-amber-700 hover:bg-amber-50">
                <Plus className="w-4 h-4 mr-1" /> Nouvelle demande
              </Button>
            </Link>
          </div>
          <p className="text-sm opacity-90 mt-2">
            Suivi de l'évolution de tes sollicitations dans le workflow d'approbation et de paiement.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 mb-4">Tu n'as encore créé aucune demande de dépense.</p>
            <Link href="/expenses/requests/quick">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                <Zap className="w-4 h-4 mr-1" /> Créer ma première demande
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <Link
                key={req.ExpenseRequestId}
                href={`/expenses/requests/${req.ExpenseRequestId}`}
                className="block bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{req.Title}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{req.RequestNumber}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{fmtXof(req.Amount)}</p>
                    <p className="text-xs text-gray-500">{fmtDate(req.CreatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {req.CategoryLabel && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                      {req.CategoryLabel}
                    </span>
                  )}
                  <StepIndicator status={req.Status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyExpenseRequestsPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.EXPENSE_CREATE}>
      <Content />
    </ProtectedPage>
  );
}
