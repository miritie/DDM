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
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ListChecks,
  ArrowRightLeft,
  Zap,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { StockItem, StockStatistics, StockAlert, Warehouse, Product } from '@/types/modules';
import { ProductVisualCard } from '@/components/stock/product-visual-card';

export default function StockPage() {
  const router = useRouter();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [statistics, setStatistics] = useState<StockStatistics | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    try {
      setLoading(true);

      // Load statistics
      const statsRes = await fetch('/api/stock/statistics');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData.data);
      }

      // Load alerts
      const alertsRes = await fetch('/api/stock/alerts');
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.data || []);
      }

      // Load warehouses
      const warehousesRes = await fetch('/api/stock/warehouses?isActive=true');
      if (warehousesRes.ok) {
        const warehousesData = await warehousesRes.json();
        setWarehouses(warehousesData.data || []);
      }

      // Load products
      const productsRes = await fetch('/api/products?isActive=true');
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.data || []);
      }

      // Load stock items
      const params = new URLSearchParams();
      if (filter === 'low_stock') {
        params.append('lowStock', 'true');
      } else if (filter === 'out_of_stock') {
        params.append('outOfStock', 'true');
      }

      const itemsRes = await fetch(`/api/stock/items?${params.toString()}`);
      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        setStockItems(itemsData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getProductName(productId: string): string {
    const product = products.find((p) => p.ProductId === productId);
    return product?.Name || 'Produit inconnu';
  }

  function getWarehouseName(warehouseId: string): string {
    const warehouse = warehouses.find((w) => w.WarehouseId === warehouseId);
    return warehouse?.Name || 'Entrepôt inconnu';
  }

  // Fusionner stock items avec les données produits pour affichage visuel
  function getEnrichedStockItems(): Array<StockItem & { product?: Product; warehouse?: Warehouse }> {
    return stockItems.map((item) => ({
      ...item,
      product: products.find((p) => p.ProductId === item.ProductId),
      warehouse: warehouses.find((w) => w.WarehouseId === item.WarehouseId),
    }));
  }

  function getStockStatus(quantity: number, minimum: number): 'out' | 'low' | 'ok' {
    if (quantity === 0) return 'out';
    if (quantity <= minimum) return 'low';
    return 'ok';
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

  const enrichedItems = getEnrichedStockItems();

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_VIEW}>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 pb-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold flex items-center gap-2 mb-6">
              <Package className="w-7 h-7" />
              Stocks & Mouvements
            </h1>

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
                onClick={() => router.push('/stock/warehouses')}
                className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl p-4 hover:scale-105 active:scale-95 transition-transform"
              >
                <WarehouseIcon className="w-8 h-8 mb-2 mx-auto" />
                <p className="font-semibold text-sm">Entrepôts</p>
                <p className="text-xs opacity-90 mt-1">Gérer lieux</p>
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

          {/* Filtres */}
          <div className="bg-white rounded-2xl shadow-xl p-4 mb-4">
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Tous les produits
              </button>
              <button
                onClick={() => setFilter('low_stock')}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filter === 'low_stock'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Stock Faible
              </button>
              <button
                onClick={() => setFilter('out_of_stock')}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filter === 'out_of_stock'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <TrendingDown className="w-4 h-4 inline mr-1" />
                Ruptures
              </button>
            </div>
          </div>

          {/* Grille visuelle des produits */}
          <div className="mb-4 px-2">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{enrichedItems.length}</span>{' '}
              {enrichedItems.length > 1 ? 'produits' : 'produit'}
            </p>
          </div>

          {enrichedItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl shadow">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun produit en stock</p>
              <Button
                onClick={() => router.push('/stock/movements/quick')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ArrowRightLeft className="w-5 h-5 mr-2" />
                Ajouter du stock
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {enrichedItems.map((item) => {
                if (!item.product) return null;

                return (
                  <div key={item.StockItemId} className="relative">
                    <ProductVisualCard
                      product={item.product}
                      stockQuantity={item.Quantity}
                      minimumStock={item.MinimumStock}
                      onClick={() => {
                        // Show details or navigate
                        router.push(`/stock/items/${item.StockItemId}`);
                      }}
                      showStock={true}
                      size="md"
                    />
                    {/* Badge entrepôt */}
                    {item.warehouse && (
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
                        <p className="text-[10px] font-semibold text-gray-700 flex items-center gap-1">
                          <WarehouseIcon className="w-3 h-3" />
                          {item.warehouse.Name}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}
