'use client';

/**
 * Dashboard Production
 *
 * Vue dédiée au manager production / opérateur production :
 *   - Ordres de production par statut (à valider, à exécuter, en cours, terminés)
 *   - Accès rapide : recettes, ingrédients, ordres
 *   - Workflow : draft (saisi) → planned (validé admin) → in_progress (production démarrée)
 *                → completed (terminé, stock alimenté)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Factory, ChefHat, Package, ListChecks, AlertTriangle, CheckCircle,
  Clock, Play, RefreshCw, Loader2, Plus, ArrowRight,
} from 'lucide-react';

interface OrderSummary {
  id: string;
  ProductionOrderId?: string;
  OrderNumber?: string;
  ProductName?: string;
  PlannedQuantity?: number;
  Status: string;
  PlannedStartDate?: string;
  PlannedEndDate?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:        { label: 'À valider',  color: 'amber' },
  planned:      { label: 'Validé',     color: 'blue' },
  in_progress:  { label: 'En cours',   color: 'purple' },
  completed:    { label: 'Terminé',    color: 'emerald' },
  cancelled:    { label: 'Annulé',     color: 'gray' },
};

export default function ProductionDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/production/orders');
      if (r.ok) {
        const { data } = await r.json();
        setOrders(data || []);
      }
    } finally { setLoading(false); }
  }

  async function refresh() {
    setRefreshing(true); await load(); setRefreshing(false);
  }

  const buckets = {
    draft:       orders.filter(o => o.Status === 'draft'),
    planned:     orders.filter(o => o.Status === 'planned'),
    in_progress: orders.filter(o => o.Status === 'in_progress'),
    completed:   orders.filter(o => o.Status === 'completed'),
  };

  return (
    <ProtectedPage permission={PERMISSIONS.PRODUCTION_VIEW}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 text-white p-6 sticky top-0 z-10 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Factory className="w-10 h-10" />
              <div>
                <h1 className="text-3xl font-bold">Dashboard Production</h1>
                <p className="text-sm opacity-90">Ordres de fabrication, recettes, intrants</p>
              </div>
            </div>
            <button onClick={refresh} disabled={refreshing}
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30">
              <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* KPIs par statut */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard count={buckets.draft.length}        label="À valider"        color="amber"   icon={AlertTriangle} />
            <KpiCard count={buckets.planned.length}      label="Validés à produire" color="blue"   icon={CheckCircle} />
            <KpiCard count={buckets.in_progress.length}  label="En cours"         color="purple"  icon={Play} />
            <KpiCard count={buckets.completed.length}    label="Terminés"         color="emerald" icon={CheckCircle} />
          </div>

          {/* Bandeaux d'ordres */}
          <Section title="Ordres en attente de validation" tone="amber"
            description="Saisis par le manager commercial — à approuver par l'administrateur avant exécution."
            orders={buckets.draft}
            actionLabel="Voir & valider"
            onItemClick={(o) => router.push('/production/orders')}
            emptyText="Aucun ordre en attente." />

          <Section title="Ordres validés à exécuter" tone="blue"
            description="Ordres approuvés et prêts à démarrer. Vérifiez le stock d'ingrédients avant lancement."
            orders={buckets.planned}
            actionLabel="Démarrer"
            onItemClick={(o) => router.push('/production/orders')}
            emptyText="Aucun ordre prêt." />

          <Section title="Ordres en cours de production" tone="purple"
            description="Suivez l'avancement, consommez les intrants, créez les batches."
            orders={buckets.in_progress}
            actionLabel="Suivre"
            onItemClick={(o) => router.push('/production/orders')}
            emptyText="Aucune production en cours." />

          {/* Actions rapides */}
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
            <CardHeader className="pb-3">
              <CardTitle>Actions Rapides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <ActionButton href="/production/orders/new" icon={Plus} label="Nouvel ordre"
                  desc="Saisir une demande" color="purple" />
                <ActionButton href="/production/orders" icon={ListChecks} label="Tous les ordres"
                  desc="Liste complète" color="blue" />
                <ActionButton href="/orders" icon={ListChecks} label="Commandes clients"
                  desc="Voir commandes négociées à produire" color="emerald" />
                <ActionButton href="/production/recipes" icon={ChefHat} label="Recettes"
                  desc="Catalogue + coûts" color="emerald" />
                <ActionButton href="/production" icon={Package} label="Module production"
                  desc="Vue d'ensemble" color="amber" />
              </div>
            </CardContent>
          </Card>

          {loading && <p className="text-center text-sm text-gray-500"><Loader2 className="w-4 h-4 inline animate-spin" /> Chargement…</p>}
        </div>
      </div>
    </ProtectedPage>
  );
}

function KpiCard({ count, label, color, icon: Icon }: { count: number; label: string; color: string; icon: any }) {
  const palette: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    purple: 'border-purple-200 bg-purple-50 text-purple-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return (
    <div className={`p-4 rounded-2xl border-2 ${palette[color]}`}>
      <div className="flex items-center justify-between">
        <Icon className="w-6 h-6" />
        <span className="text-3xl font-bold">{count}</span>
      </div>
      <p className="mt-2 text-sm font-semibold">{label}</p>
    </div>
  );
}

function Section({ title, tone, description, orders, actionLabel, onItemClick, emptyText }: {
  title: string; tone: 'amber' | 'blue' | 'purple'; description: string;
  orders: OrderSummary[]; actionLabel: string; onItemClick: (o: OrderSummary) => void; emptyText: string;
}) {
  const palette = {
    amber:  { card: 'border-amber-200 bg-white', badge: 'bg-amber-100 text-amber-700' },
    blue:   { card: 'border-blue-200 bg-white',  badge: 'bg-blue-100 text-blue-700' },
    purple: { card: 'border-purple-200 bg-white',badge: 'bg-purple-100 text-purple-700' },
  }[tone];
  return (
    <Card className={`border-2 ${palette.card}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${palette.badge}`}>{orders.length}</span>
        </CardTitle>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 5).map(o => (
              <button key={o.id || o.ProductionOrderId} onClick={() => onItemClick(o)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded border text-left">
                <div>
                  <p className="font-semibold text-sm">{o.OrderNumber || o.ProductionOrderId}</p>
                  <p className="text-xs text-gray-600">
                    {o.ProductName} · qté prévue : <strong>{o.PlannedQuantity}</strong>
                    {o.PlannedStartDate && ` · début ${new Date(o.PlannedStartDate).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                  {actionLabel} <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            ))}
            {orders.length > 5 && (
              <Link href="/production/orders" className="block text-center text-sm text-blue-600 hover:underline">
                Voir les {orders.length - 5} autres →
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionButton({ href, icon: Icon, label, desc, color }: { href: string; icon: any; label: string; desc: string; color: string }) {
  const palette: Record<string, string> = {
    purple: 'bg-gradient-to-br from-purple-500 to-purple-600',
    blue: 'bg-gradient-to-br from-blue-500 to-cyan-600',
    emerald: 'bg-gradient-to-br from-emerald-500 to-green-600',
    amber: 'bg-gradient-to-br from-amber-500 to-orange-600',
  };
  return (
    <Link href={href} className="block">
      <div className={`${palette[color]} text-white rounded-xl p-4 hover:shadow-md transition`}>
        <Icon className="w-6 h-6 mb-2" />
        <p className="font-bold text-sm">{label}</p>
        <p className="text-xs opacity-90 mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}
