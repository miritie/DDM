'use client';

/**
 * Page - Dashboard Production (Mobile-First)
 * Module Production & Usine
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Factory,
  Package,
  FileText,
  TrendingUp,
  AlertTriangle,
  Plus,
  PlayCircle,
  CheckCircle,
  Clock,
  Beaker,
  ChevronRight,
  ClipboardList,
  ShoppingCart,
  ArrowRightLeft,
  Boxes,
} from 'lucide-react';
import { ProductionOrder } from '@/types/modules';
import { ProductionOrderCard } from '@/components/production/production-order-card';
import { Button } from '@/components/ui/button';

interface ProductionStatistics {
  totalOrders: number;
  ordersInProgress: number;
  ordersCompleted: number;
  totalProduced: number;
  activeRecipes: number;
  avgYieldRate: number;
}

export default function ProductionPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [statistics, setStatistics] = useState<ProductionStatistics | null>(null);
  const [mpBelowMin, setMpBelowMin] = useState(0);
  const [pendingPRs, setPendingPRs] = useState(0);
  // UUID du 1er entrepôt marqué « Adossé à l'unité de production ».
  // Sert à pré-filtrer le raccourci Inventaire PF (le wizard de
  // transfert se débrouille côté serveur via ?fromProduction=1).
  const [productionWarehouseId, setProductionWarehouseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'planned'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [ordersRes, statsRes, mpRes, prRes, whRes] = await Promise.all([
        fetch('/api/production/orders'),
        fetch('/api/production/orders/statistics'),
        fetch('/api/production/ingredients?belowMinimum=true&isActive=true'),
        fetch('/api/production/purchase-requests'),
        fetch('/api/stock/warehouses?isActive=true&isProductionSource=true'),
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.data);
      }

      if (mpRes.ok) {
        const mpData = await mpRes.json();
        setMpBelowMin((mpData.data || []).length);
      }

      if (prRes.ok) {
        const prData = (await prRes.json()).data || [];
        // Sollicitations à suivre : draft/submitted/approved non encore reçues
        // intégralement. Les rejected/cancelled/fully-received sortent.
        const isFullyReceived = (p: any) => {
          const lines: any[] = p.lines || p.Lines || [];
          if (lines.length === 0) return false;
          const req = lines.reduce((s, l) => s + Number(l.QtyRequested ?? 0), 0);
          const rec = lines.reduce((s, l) => s + Number(l.QtyReceived ?? 0), 0);
          return req > 0 && rec >= req;
        };
        const pending = prData
          .filter((p: any) => ['draft', 'submitted', 'approved'].includes(p.Status))
          .filter((p: any) => !isFullyReceived(p));
        setPendingPRs(pending.length);
      }

      if (whRes.ok) {
        const whs = ((await whRes.json()).data || []) as any[];
        // Premier entrepôt flagué source production. S'il y en a plusieurs,
        // l'utilisateur choisira sur l'écran d'inventaire (qui propose le
        // sélecteur). S'il n'y en a aucun, on laisse à null (les liens
        // partiront alors sans pré-filtre et le sélecteur se chargera).
        const prod = whs[0];
        if (prod) setProductionWarehouseId(prod.id || prod.warehouse_id || prod.WarehouseId);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'in_progress') return order.Status === 'in_progress';
    if (filter === 'planned') return order.Status === 'planned';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <Factory className="w-7 h-7" />
            Production & Usine
          </h1>

          {/* KPIs */}
          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-5 h-5" />
                  <span className="text-sm opacity-90">Total Ordres</span>
                </div>
                <p className="text-3xl font-bold">{statistics.totalOrders}</p>
                <p className="text-xs opacity-80 mt-1">Tous statuts</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PlayCircle className="w-5 h-5" />
                  <span className="text-sm opacity-90">En Cours</span>
                </div>
                <p className="text-3xl font-bold">{statistics.ordersInProgress}</p>
                <p className="text-xs opacity-80 mt-1">Actifs</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm opacity-90">Terminés</span>
                </div>
                <p className="text-3xl font-bold">{statistics.ordersCompleted}</p>
                <p className="text-xs opacity-80 mt-1">Ce mois</p>
              </div>

              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-sm opacity-90">Rendement Moy.</span>
                </div>
                <p className="text-3xl font-bold">{statistics.avgYieldRate}%</p>
                <p className="text-xs opacity-80 mt-1">Qualité</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Actions rapides */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Actions Rapides</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <button
              onClick={() => router.push('/production/orders/new')}
              className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <Plus className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Nouvel Ordre</p>
              <p className="text-xs opacity-90 mt-1">Lancer production</p>
            </button>

            <button
              onClick={() => router.push('/production/recipes')}
              className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <FileText className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Recettes</p>
              <p className="text-xs opacity-90 mt-1">Gérer formules</p>
            </button>

            <button
              onClick={() => router.push('/production/ingredients')}
              className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <Beaker className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Matières premières</p>
              <p className="text-xs opacity-90 mt-1">PMP, stock, fournisseurs</p>
            </button>

            <button
              onClick={() => router.push('/production/ingredients/inventory')}
              className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <ClipboardList className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Inventaire MP</p>
              <p className="text-xs opacity-90 mt-1">Comptage physique</p>
            </button>

            <button
              onClick={() => router.push('/production/purchase-requests')}
              className="bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <Package className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Achats MP</p>
              <p className="text-xs opacity-90 mt-1">Sollicitations &amp; réceptions</p>
            </button>
          </div>
        </div>

        {/* Stock Produits Finis — wrappers vers /stock/* pré-filtré
            sur l'entrepôt unité de production (WH-001 « Usine »).
            Tant que l'UUID n'est pas résolu, les liens partent sans
            pré-filtre (la page /stock/* propose un sélecteur). */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-1">Stock produits finis</h2>
          <p className="text-xs text-gray-500 mb-4">
            Comptage et sortie du stock PF depuis l'unité de production.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push(
                productionWarehouseId
                  ? `/stock/inventory?warehouseId=${productionWarehouseId}`
                  : '/stock/inventory'
              )}
              className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <Boxes className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Inventaire PF</p>
              <p className="text-xs opacity-90 mt-1">Comptage produits finis</p>
            </button>

            <button
              onClick={() => router.push('/stock/transfers/new?fromProduction=1')}
              className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
            >
              <ArrowRightLeft className="w-8 h-8 mb-2 mx-auto" />
              <p className="font-semibold text-sm">Mouvement de stock</p>
              <p className="text-xs opacity-90 mt-1">Transfert vers entrepôt / PdV</p>
            </button>
          </div>
        </div>

        {/* Ordres en cours/urgents */}
        {statistics && statistics.ordersInProgress > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Ordres en Production ({statistics.ordersInProgress})
              </h2>
              <button
                onClick={() => router.push('/production/orders?status=in_progress')}
                className="text-sm text-orange-600 font-medium flex items-center gap-1"
              >
                Tout voir
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {orders
                .filter((order) => order.Status === 'in_progress')
                .slice(0, 3)
                .map((order) => (
                  <ProductionOrderCard
                    key={order.ProductionOrderId}
                    order={order}
                    onClick={() =>
                      router.push(`/production/orders/${order.ProductionOrderId}`)
                    }
                    showDetails={true}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Actions à mener (synthèse) */}
        {(() => {
          const submittedCount = orders.filter(o => o.Status === 'submitted').length;
          const plannedCount   = orders.filter(o => o.Status === 'planned').length;
          const items = [
            { count: mpBelowMin,     label: 'MP sous minimum',        href: '/production/ingredients?belowMinimum=1', tone: 'orange', icon: AlertTriangle },
            { count: pendingPRs,     label: 'Sollicitations en cours', href: '/production/purchase-requests',          tone: 'amber',  icon: ShoppingCart },
            { count: submittedCount, label: 'OP à valider',            href: '/production/orders?status=submitted',    tone: 'amber',  icon: Clock },
            { count: plannedCount,   label: 'OP à démarrer',           href: '/production/orders?status=planned',      tone: 'blue',   icon: PlayCircle },
          ].filter(i => i.count > 0);

          const toneClasses: Record<string, string> = {
            orange: 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100',
            amber:  'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
            blue:   'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
          };
          const badgeClasses: Record<string, string> = {
            orange: 'bg-orange-600 text-white',
            amber:  'bg-amber-600 text-white',
            blue:   'bg-blue-600 text-white',
          };

          return (
            <div className="bg-white rounded-2xl shadow-xl p-4 mb-6">
              <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                Actions à mener
              </h2>
              {items.length === 0 ? (
                <p className="text-sm text-gray-500 py-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Aucune action en attente.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.label}
                        onClick={() => router.push(it.href)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${toneClasses[it.tone]}`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{it.label}</span>
                        <span className={`ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-full px-1.5 text-xs font-bold ${badgeClasses[it.tone]}`}>
                          {it.count}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Filtres ordres */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous les ordres
            </button>
            <button
              onClick={() => setFilter('planned')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === 'planned'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-1" />
              Planifiés
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === 'in_progress'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <PlayCircle className="w-4 h-4 inline mr-1" />
              En cours
            </button>
          </div>
        </div>

        {/* Compteur */}
        <div className="mb-4 px-2">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filteredOrders.length}</span>{' '}
            {filteredOrders.length > 1 ? 'ordres trouvés' : 'ordre trouvé'}
          </p>
        </div>

        {/* Liste ordres */}
        <div className="space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <ProductionOrderCard
                key={order.ProductionOrderId}
                order={order}
                onClick={() => router.push(`/production/orders/${order.ProductionOrderId}`)}
                showDetails={true}
              />
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Factory className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun ordre de production</p>
              <Button
                onClick={() => router.push('/production/orders/new')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Créer un ordre
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
