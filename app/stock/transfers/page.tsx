'use client';

/**
 * Page - Liste des transferts de stock 1→N
 *
 * 3 onglets :
 *  - À recevoir (au moins 1 leg pending dans le workspace)
 *  - Tous (vue gestion)
 *  - Clos (fully_received / cancelled)
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft, Plus, RefreshCw, Search, ChevronRight, AlertCircle,
  CheckCircle, Clock, XCircle, Package,
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
  draft:               { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  in_transit:          { label: 'En transit', color: 'bg-blue-100 text-blue-700', icon: ArrowRightLeft },
  partially_received:  { label: 'Partiellement reçu', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  fully_received:      { label: 'Reçu', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled:           { label: 'Annulé', color: 'bg-red-100 text-red-700', icon: XCircle },
};

type Tab = 'pending' | 'all' | 'closed';

export default function TransfersPage() {
  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <Content />
    </ProtectedPage>
  );
}

function Content() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);   // filtré par destinations dont user est manager
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [allR, incR] = await Promise.all([
        fetch('/api/stock/transfers', { cache: 'no-store' }),
        fetch('/api/stock/transfers/incoming', { cache: 'no-store' }),
      ]);
      if (allR.ok) setItems(((await allR.json()).data) || []);
      if (incR.ok) setIncoming(((await incR.json()).data) || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // Source des items selon onglet
  const sourceItems = tab === 'pending' ? incoming : items;

  const filtered = sourceItems.filter((t) => {
    const isClosed = t.status === 'fully_received' || t.status === 'cancelled';
    if (tab === 'closed' && !isClosed) return false;
    if (tab === 'all') {
      // pas de filtre statut
    }
    if (search) {
      const q = search.toLowerCase();
      const sourceName = (t.source_warehouse_name || t.source_outlet_name || '').toLowerCase();
      if (!t.transfer_number?.toLowerCase().includes(q) && !sourceName.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    pending: incoming.length,                                                   // ce qui me concerne
    all: items.length,
    closed: items.filter((t) => t.status === 'fully_received' || t.status === 'cancelled').length,
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="w-7 h-7" /> Transferts de stock
            </h1>
            <div className="flex gap-2">
              <button onClick={load} className="p-3 bg-white/20 rounded-full hover:bg-white/30">
                <RefreshCw className="w-5 h-5" />
              </button>
              <Can permission={PERMISSIONS.STOCK_TRANSFER}>
                <Button
                  onClick={() => router.push('/stock/transfers/new')}
                  className="bg-white text-cyan-600 hover:bg-cyan-50 h-12 px-6 rounded-xl font-semibold shadow-lg"
                >
                  <Plus className="w-5 h-5 mr-2" /> Nouveau
                </Button>
              </Can>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (numéro, source)…"
              className="w-full pl-12 h-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { id: 'pending' as Tab, label: 'À recevoir', count: counts.pending, tone: 'amber' },
              { id: 'all' as Tab, label: 'Tous', count: counts.all, tone: 'cyan' },
              { id: 'closed' as Tab, label: 'Clos', count: counts.closed, tone: 'gray' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  tab === t.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t.label}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  tab === t.id ? 'bg-white/30' : 'bg-white text-gray-600'
                }`}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
            {tab === 'pending' ? 'Aucun transfert en attente de réception.' :
             tab === 'closed' ? 'Aucun transfert clos.' :
             'Aucun transfert. Cliquez sur « Nouveau » pour démarrer.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <TransferRow key={t.id} t={t} onClick={() => router.push(`/stock/transfers/${t.transfer_id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransferRow({ t, onClick }: { t: any; onClick: () => void }) {
  const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  const lines = t.lines || [];
  const totalSent = lines.reduce((s: number, l: any) => s + Number(l.qty_sent), 0);
  const totalReceived = lines.reduce((s: number, l: any) => s + Number(l.qty_received), 0);
  const pendingCount = lines.filter((l: any) => l.leg_status === 'pending').length;
  const destinations = new Set(
    lines.map((l: any) => l.destination_warehouse_name || l.destination_outlet_name).filter(Boolean)
  );
  const sourceName = t.source_warehouse_name || t.source_outlet_name || '?';

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl shadow p-4 flex items-center gap-4 hover:shadow-lg text-left"
    >
      <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-white shrink-0">
        <ArrowRightLeft className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="font-semibold truncate">{t.transfer_number}</h3>
          <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${cfg.color}`}>
            <Icon className="w-3 h-3" /> {cfg.label}
          </span>
          {pendingCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              {pendingCount} en attente
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
          <Package className="w-3 h-3" />
          <span><strong>{sourceName}</strong> → {[...destinations].slice(0, 3).join(', ')}{destinations.size > 3 ? ` +${destinations.size - 3}` : ''}</span>
          <span>·</span>
          <span>{lines.length} ligne{lines.length > 1 ? 's' : ''} · {fmt(totalReceived)}/{fmt(totalSent)}</span>
          <span>·</span>
          <span>{fmtDate(t.created_at)}</span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </button>
  );
}
