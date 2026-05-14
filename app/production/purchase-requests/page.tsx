'use client';

/**
 * Page - Sollicitations d'achat MP
 *
 * Liste avec filtres par statut, accès aux actions selon permissions :
 * - purchase_request:create (manager_production + manager_compta_stocks) → bouton « Nouvelle »
 * - purchase_request:approve (admin) → actions dans la liste / détail
 * - purchase_request:receive (manager_production + manager_compta_stocks) → réception
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Plus, Search, ChevronRight, CheckCircle, XCircle,
  Clock, AlertTriangle, Send, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { Can } from '@/components/rbac/can';
import { PERMISSIONS } from '@/lib/rbac';

const fmt = (n: number | string | undefined) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)));

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  submitted: { label: 'À valider', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  approved: { label: 'Approuvée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Refusée', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'Annulée', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

export default function PurchaseRequestsPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.PURCHASE_REQUEST_VIEW}>
      <Content />
    </ProtectedPage>
  );
}

function Content() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    try {
      const url = statusFilter === 'all'
        ? '/api/production/purchase-requests'
        : `/api/production/purchase-requests?status=${statusFilter}`;
      const r = await fetch(url);
      if (r.ok) setItems((await r.json()).data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const filtered = items.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.Title?.toLowerCase().includes(q) || p.RequestNumber?.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-7 h-7" /> Achats matières premières
            </h1>
            <Can permission={PERMISSIONS.PURCHASE_REQUEST_CREATE}>
              <Button
                onClick={() => router.push('/production/purchase-requests/new')}
                className="bg-white text-amber-600 hover:bg-amber-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" /> Nouvelle
              </Button>
            </Can>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-12 h-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'draft', 'submitted', 'approved', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  statusFilter === s ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {s === 'all' ? 'Toutes' : STATUS_CONFIG[s]?.label || s}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
            Aucune sollicitation. Créez-en une nouvelle pour démarrer le cycle d'achat MP.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((pr) => (
              <PRRow key={pr.id} pr={pr} onClick={() => router.push(`/production/purchase-requests/${pr.ExpenseRequestId}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PRRow({ pr, onClick }: { pr: any; onClick: () => void }) {
  const config = STATUS_CONFIG[pr.Status] || STATUS_CONFIG.draft;
  const Icon = config.icon;
  const lines = pr.Lines || [];
  const totalReq = lines.reduce((s: number, l: any) => s + Number(l.QtyRequested), 0);
  const totalRec = lines.reduce((s: number, l: any) => s + Number(l.QtyReceived), 0);
  const isFullyReceived = lines.length > 0 && lines.every((l: any) => Number(l.QtyReceived) >= Number(l.QtyRequested));

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl shadow p-4 flex items-center gap-4 hover:shadow-lg transition-shadow text-left"
    >
      <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white shrink-0">
        <Package className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold truncate">{pr.Title}</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{pr.RequestNumber}</span>
          <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${config.color}`}>
            <Icon className="w-3 h-3" /> {config.label}
          </span>
          {pr.Status === 'approved' && isFullyReceived && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
              Tout reçu
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
          <span className="font-semibold">{fmt(pr.Amount)} XOF</span>
          <span>·</span>
          <span>{lines.length} ligne{lines.length > 1 ? 's' : ''}</span>
          {pr.Status === 'approved' && (
            <>
              <span>·</span>
              <span>{fmt(totalRec)}/{fmt(totalReq)} reçu</span>
            </>
          )}
          <span>·</span>
          <span>{fmtDate(pr.CreatedAt)}</span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </button>
  );
}
