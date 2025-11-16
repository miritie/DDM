'use client';

/**
 * Page - Inventaire Mobile Ultra-Rapide (Mobile-First)
 * Interface visuelle optimisée pour comptage terrain rapide
 * Usage: Stands, dépôts partenaires, entrepôts, production
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Package,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { Product, Warehouse, StockItem } from '@/types/modules';
import { ProductVisualCard } from '@/components/stock/product-visual-card';
import { Button } from '@/components/ui/button';

interface InventoryCount {
  productId: string;
  productName: string;
  currentStock: number;
  countedStock: number;
  difference: number;
}

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const warehouseId = searchParams.get('warehouseId');

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<
    Map<string, InventoryCount>
  >(new Map());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [countValue, setCountValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (warehouseId) {
      loadData();
    }
  }, [warehouseId]);

  async function loadData() {
    try {
      setLoading(true);

      // Charger l'entrepôt
      const warehouseRes = await fetch(`/api/stock/warehouses/${warehouseId}`);
      if (warehouseRes.ok) {
        const warehouseData = await warehouseRes.json();
        setWarehouse(warehouseData.data);
      }

      // Charger les produits actifs
      const productsRes = await fetch('/api/products?isActive=true');
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.data || []);
      }

      // Charger les stocks actuels pour cet entrepôt
      const stockRes = await fetch(
        `/api/stock/items?warehouseId=${warehouseId}`
      );
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        setStockItems(stockData.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  }

  const getCurrentStock = (productId: string): number => {
    const stockItem = stockItems.find((s) => s.ProductId === productId);
    return stockItem?.Quantity || 0;
  };

  const getCountedStock = (productId: string): number | null => {
    const count = inventoryCounts.get(productId);
    return count ? count.countedStock : null;
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    const existingCount = inventoryCounts.get(product.ProductId);
    setCountValue(
      existingCount ? String(existingCount.countedStock) : ''
    );
  };

  const handleCountConfirm = () => {
    if (!selectedProduct || countValue === '') return;

    const counted = parseInt(countValue);
    const current = getCurrentStock(selectedProduct.ProductId);
    const difference = counted - current;

    const inventoryCount: InventoryCount = {
      productId: selectedProduct.ProductId,
      productName: selectedProduct.Name,
      currentStock: current,
      countedStock: counted,
      difference,
    };

    const newCounts = new Map(inventoryCounts);
    newCounts.set(selectedProduct.ProductId, inventoryCount);
    setInventoryCounts(newCounts);

    // Réinitialiser
    setSelectedProduct(null);
    setCountValue('');
  };

  const handleQuickCount = (product: Product, value: number) => {
    const current = getCurrentStock(product.ProductId);
    const difference = value - current;

    const inventoryCount: InventoryCount = {
      productId: product.ProductId,
      productName: product.Name,
      currentStock: current,
      countedStock: value,
      difference,
    };

    const newCounts = new Map(inventoryCounts);
    newCounts.set(product.ProductId, inventoryCount);
    setInventoryCounts(newCounts);
  };

  const handleSaveInventory = async () => {
    if (inventoryCounts.size === 0) return;

    setSaving(true);
    try {
      const adjustments = Array.from(inventoryCounts.values())
        .filter((count) => count.difference !== 0)
        .map((count) => ({
          productId: count.productId,
          warehouseId,
          currentQuantity: count.currentStock,
          countedQuantity: count.countedStock,
          difference: count.difference,
        }));

      const response = await fetch('/api/stock/inventory/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId,
          adjustments,
          notes: `Inventaire mobile ${new Date().toLocaleDateString('fr-FR')}`,
        }),
      });

      if (response.ok) {
        alert('Inventaire enregistré avec succès!');
        router.push(`/stock?warehouseId=${warehouseId}`);
      } else {
        alert('Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const getDifferenceColor = (diff: number) => {
    if (diff === 0) return 'text-gray-600';
    if (diff > 0) return 'text-green-600';
    return 'text-red-600';
  };

  const totalDifferences = Array.from(inventoryCounts.values()).reduce(
    (sum, count) => sum + Math.abs(count.difference),
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-3 hover:opacity-80"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6" />
                Inventaire Rapide
              </h1>
              <p className="text-sm opacity-90 mt-1">
                {warehouse?.Name || 'Entrepôt'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm opacity-90">Comptés</p>
              <p className="text-3xl font-bold">
                {inventoryCounts.size}/{products.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Résumé rapide */}
        {inventoryCounts.size > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg">Résumé</h2>
              <button
                onClick={() => setShowSummary(!showSummary)}
                className="text-blue-600 text-sm font-semibold"
              >
                {showSummary ? 'Masquer' : 'Voir tout'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-600">Produits</p>
                <p className="text-2xl font-bold text-blue-700">
                  {inventoryCounts.size}
                </p>
              </div>

              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-600">Écarts</p>
                <p className="text-2xl font-bold text-orange-700">
                  {totalDifferences}
                </p>
              </div>

              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-600">Conformes</p>
                <p className="text-2xl font-bold text-green-700">
                  {
                    Array.from(inventoryCounts.values()).filter(
                      (c) => c.difference === 0
                    ).length
                  }
                </p>
              </div>
            </div>

            {showSummary && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Array.from(inventoryCounts.values()).map((count) => (
                  <div
                    key={count.productId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                  >
                    <span className="font-medium truncate flex-1">
                      {count.productName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">
                        {count.currentStock} →
                      </span>
                      <span className="font-bold">
                        {count.countedStock}
                      </span>
                      <span
                        className={`font-bold ${getDifferenceColor(
                          count.difference
                        )}`}
                      >
                        ({count.difference > 0 ? '+' : ''}
                        {count.difference})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Liste produits */}
        <div className="space-y-3">
          <h2 className="font-bold text-lg px-2">Produits à compter</h2>
          {products.map((product) => {
            const currentStock = getCurrentStock(product.ProductId);
            const countedStock = getCountedStock(product.ProductId);
            const isCounted = countedStock !== null;

            return (
              <div key={product.ProductId} className="relative">
                <ProductVisualCard
                  product={product}
                  stockQuantity={currentStock}
                  warehouseName={warehouse?.Name}
                  onClick={() => handleProductSelect(product)}
                  selected={isCounted}
                  showStock={true}
                  size="lg"
                />

                {isCounted && (
                  <div className="absolute bottom-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    Compté: {countedStock}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal saisie */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-0">
          <div className="bg-white rounded-t-3xl w-full max-w-2xl p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Compter: {selectedProduct.Name}
              </h2>
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setCountValue('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">Stock actuel</p>
              <p className="text-4xl font-bold text-blue-700">
                {getCurrentStock(selectedProduct.ProductId)}
              </p>
            </div>

            {/* Boutons rapides */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[0, 5, 10, 20].map((val) => (
                <button
                  key={val}
                  onClick={() => setCountValue(String(val))}
                  className="h-16 bg-gray-100 hover:bg-blue-100 rounded-xl font-bold text-lg transition-colors"
                >
                  {val}
                </button>
              ))}
            </div>

            {/* Saisie */}
            <input
              type="number"
              value={countValue}
              onChange={(e) => setCountValue(e.target.value)}
              placeholder="Quantité comptée"
              autoFocus
              className="w-full h-16 text-2xl text-center font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none mb-4"
            />

            <Button
              onClick={handleCountConfirm}
              disabled={countValue === ''}
              className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="w-6 h-6 mr-2" />
              Confirmer
            </Button>
          </div>
        </div>
      )}

      {/* Barre actions flottante */}
      {inventoryCounts.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-2xl">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <button
              onClick={() => {
                if (
                  confirm(
                    'Êtes-vous sûr de vouloir annuler cet inventaire ?'
                  )
                ) {
                  setInventoryCounts(new Map());
                }
              }}
              className="flex-1 h-14 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              Annuler
            </button>

            <button
              onClick={handleSaveInventory}
              disabled={saving}
              className="flex-[2] h-14 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Enregistrer ({inventoryCounts.size} produits)
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
