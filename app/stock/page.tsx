'use client';

/**
 * Page - Dashboard Stock (Mobile-First avec Images Produits)
 * Module Stocks & Mouvements
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  Package,
  Warehouse as WarehouseIcon,
  Store,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ListChecks,
  ArrowRightLeft,
  Zap,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { StockStatistics, StockAlert, Warehouse, Product } from '@/types/modules';

export default function StockPage() {
  const router = useRouter();
  const [statistics, setStatistics] = useState<StockStatistics | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function fetchOrFail(url: string) {
    const res = await fetch(url);
    if (!res.ok) {
      let message = `Erreur ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {}
      const err: any = new Error(message);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function loadData() {
    try {
      setLoading(true);
      setLoadError(null);

      const [stats, alertsRes, warehousesRes, productsRes] = await Promise.all([
        fetchOrFail('/api/stock/statistics'),
        fetchOrFail('/api/stock/alerts'),
        fetchOrFail('/api/stock/warehouses?isActive=true'),
        fetchOrFail('/api/products?isActive=true'),
      ]);

      setStatistics(stats.data);
      setAlerts(alertsRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      setLoadError({ status: error.status || 500, message: error.message });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    const isPermissionError = loadError.status === 403;
    return (
      <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-orange-500 mb-3" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isPermissionError ? 'Accès au stock refusé' : 'Impossible de charger le stock'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {isPermissionError
                ? 'Votre rôle actif n\'a pas la permission « stock:view ». Demandez à un administrateur d\'attribuer cette permission à votre rôle.'
                : loadError.message}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => router.push('/dashboard')} variant="outline">
                Retour à l'accueil
              </Button>
              {!isPermissionError && (
                <Button onClick={() => loadData()}>Réessayer</Button>
              )}
            </div>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-7 h-7" />
                Stocks & Mouvements
              </h1>
              <button
                onClick={() => router.push('/stock/overview')}
                className="px-4 py-2 bg-white/90 hover:bg-white text-blue-700 font-semibold rounded-lg shadow-md inline-flex items-center gap-2"
              >
                <Eye className="w-4 h-4" /> État des stocks (cumul + détail)
              </button>
            </div>

            {/* KPIs */}
            {statistics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-sm opacity-90">Valeur Totale</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('fr-FR', {
                      notation: 'compact',
                      compactDisplay: 'short',
                    }).format(statistics.totalValue)}{' '}
                    F
                  </p>
                  <p className="text-xs opacity-80 mt-1">{statistics.totalItems} articles</p>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <WarehouseIcon className="w-5 h-5" />
                    <span className="text-sm opacity-90">Entrepôts</span>
                  </div>
                  <p className="text-3xl font-bold">{statistics.warehousesCount}</p>
                  <p className="text-xs opacity-80 mt-1">Actifs</p>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-sm opacity-90">Stock Faible</span>
                  </div>
                  <p className="text-3xl font-bold">{statistics.lowStockItems}</p>
                  <p className="text-xs opacity-80 mt-1">À surveiller</p>
                </div>

                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-5 h-5" />
                    <span className="text-sm opacity-90">Ruptures</span>
                  </div>
                  <p className="text-3xl font-bold">{statistics.outOfStockItems}</p>
                  <p className="text-xs opacity-80 mt-1">Urgent</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div className="max-w-7xl mx-auto px-4 -mt-4">{" "}
          {/* Actions rapides */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="font-bold text-lg mb-4">Actions Rapides</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => router.push('/stock/inventory')}
                className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
              >
                <ListChecks className="w-8 h-8 mb-2 mx-auto" />
                <p className="font-semibold text-sm">Inventaire</p>
                <p className="text-xs opacity-90 mt-1">Comptage rapide</p>
              </button>

              <button
                onClick={() => router.push('/stock/movements/quick')}
                className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
              >
                <ArrowRightLeft className="w-8 h-8 mb-2 mx-auto" />
                <p className="font-semibold text-sm">Mouvement</p>
                <p className="text-xs opacity-90 mt-1">Entrée / Sortie</p>
              </button>

              <button
                onClick={() => router.push('/stock/markdowns/new')}
                className="bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
              >
                <TrendingDown className="w-8 h-8 mb-2 mx-auto" />
                <p className="font-semibold text-sm">Démarques</p>
                <p className="text-xs opacity-90 mt-1">Pertes / Casse</p>
              </button>

              <button
                onClick={() => router.push('/stock/overview')}
                className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
              >
                <Eye className="w-8 h-8 mb-2 mx-auto" />
                <p className="font-semibold text-sm">État global</p>
                <p className="text-xs opacity-90 mt-1">Matrice + cumul</p>
              </button>
            </div>
          </div>

          {/* Navigation par emplacement — accès direct aux vues focalisées */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="font-bold text-lg mb-1">Stocks par emplacement</h2>
            <p className="text-sm text-gray-600 mb-4">Voir le stock détaillé, filtrable et trié, d'un entrepôt ou d'un stand.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/stock/warehouses')}
                className="text-left p-5 rounded-xl border-2 border-violet-200 hover:border-violet-400 hover:shadow-md transition-all bg-gradient-to-br from-violet-50 to-white"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-lg bg-violet-600 text-white flex items-center justify-center">
                    <WarehouseIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Entrepôts</h3>
                    <p className="text-xs text-gray-600">{warehouses.length} entrepôt{warehouses.length > 1 ? 's' : ''} actif{warehouses.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700">Stocks de réserve par entrepôt — comptage, transferts, valorisation.</p>
                <div className="mt-3 text-sm font-semibold text-violet-700 flex items-center gap-1">
                  Voir les entrepôts <ChevronRight className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={() => router.push('/stock/outlets')}
                className="text-left p-5 rounded-xl border-2 border-amber-200 hover:border-amber-400 hover:shadow-md transition-all bg-gradient-to-br from-amber-50 to-white"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Stands</h3>
                    <p className="text-xs text-gray-600">Points de vente avec stock dédié</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700">Stocks des stands (POS) — vue par stand, alertes, mouvements rapides.</p>
                <div className="mt-3 text-sm font-semibold text-amber-700 flex items-center gap-1">
                  Voir les stands <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>

          {/* Alertes importantes */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Alertes Stock ({alerts.length})
                </h2>
                {alerts.length > 3 && (
                  <button
                    onClick={() => router.push('/stock/alerts')}
                    className="text-sm text-blue-600 font-medium flex items-center gap-1"
                  >
                    Tout voir
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {alerts.slice(0, 3).map((alert) => {
                  const product = products.find((p) => p.ProductId === alert.ProductId);
                  const warehouse = warehouses.find((w) => w.WarehouseId === alert.WarehouseId);
                  const alertConfig = {
                    out_of_stock: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', label: 'Rupture' },
                    low_stock: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', label: 'Stock faible' },
                    overstock: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', label: 'Surstock' },
                  }[alert.AlertType] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', label: 'Alerte' };

                  return (
                    <div
                      key={alert.AlertId}
                      className={`${alertConfig.bg} border-2 ${alertConfig.border} rounded-xl p-4`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-semibold ${alertConfig.text}`}>
                            {product?.Name || 'Produit inconnu'}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {warehouse?.Name || 'Entrepôt'} • Qté: {alert.CurrentQuantity}
                          </p>
                          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${alertConfig.bg} ${alertConfig.text}`}>
                            {alertConfig.label}
                          </span>
                        </div>
                        <Button
                          onClick={() => router.push('/stock/movements/quick')}
                          className="bg-blue-600 hover:bg-blue-700 h-10"
                        >
                          <Zap className="w-4 h-4 mr-2" />
                          Action
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </ProtectedPage>
  );
}
