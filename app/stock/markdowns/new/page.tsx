'use client';

/**
 * Page - Nouvelle Démarque (Mobile-First Visuel)
 * Enregistrement rapide des pertes, casses, vols, expirations
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingDown,
  AlertTriangle,
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Package,
  Calendar,
  FileText,
} from 'lucide-react';
import { Product, Warehouse } from '@/types/modules';
import { ProductVisualCard } from '@/components/stock/product-visual-card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

type MarkdownReason = 'damaged' | 'expired' | 'theft' | 'loss' | 'quality' | 'other';

interface MarkdownLine {
  productId: string;
  product?: Product;
  quantity: number;
  reason: MarkdownReason;
  notes?: string;
  photoUrl?: string;
}

const reasonConfig: Record<MarkdownReason, { label: string; icon: typeof AlertTriangle; color: string; gradient: string }> = {
  damaged: {
    label: 'Cassé / Endommagé',
    icon: AlertTriangle,
    color: 'text-orange-700',
    gradient: 'from-orange-500 to-red-600',
  },
  expired: {
    label: 'Expiré / Périmé',
    icon: Calendar,
    color: 'text-red-700',
    gradient: 'from-red-500 to-pink-600',
  },
  theft: {
    label: 'Vol',
    icon: AlertTriangle,
    color: 'text-purple-700',
    gradient: 'from-purple-500 to-pink-600',
  },
  loss: {
    label: 'Perte',
    icon: TrendingDown,
    color: 'text-blue-700',
    gradient: 'from-blue-500 to-cyan-600',
  },
  quality: {
    label: 'Problème Qualité',
    icon: AlertTriangle,
    color: 'text-yellow-700',
    gradient: 'from-yellow-500 to-orange-600',
  },
  other: {
    label: 'Autre',
    icon: FileText,
    color: 'text-gray-700',
    gradient: 'from-gray-500 to-gray-700',
  },
};

export default function NewMarkdownPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Warehouse, 2: Products, 3: Confirmation
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [lines, setLines] = useState<MarkdownLine[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [currentReason, setCurrentReason] = useState<MarkdownReason>('damaged');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentNotes, setCurrentNotes] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [warehousesRes, productsRes] = await Promise.all([
        fetch('/api/stock/warehouses?isActive=true'),
        fetch('/api/products?isActive=true'),
      ]);

      if (warehousesRes.ok) {
        const data = await warehousesRes.json();
        setWarehouses(data.data || []);
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleWarehouseSelect(warehouse: Warehouse) {
    setSelectedWarehouse(warehouse);
    setStep(2);
  }

  function handleProductSelect(product: Product) {
    setCurrentProduct(product);
    setShowProductModal(false);
    setShowReasonModal(true);
  }

  function handleAddLine() {
    if (!currentProduct) return;

    const newLine: MarkdownLine = {
      productId: currentProduct.ProductId,
      product: currentProduct,
      quantity: currentQuantity,
      reason: currentReason,
      notes: currentNotes || undefined,
    };

    setLines([...lines, newLine]);

    // Reset
    setCurrentProduct(null);
    setCurrentReason('damaged');
    setCurrentQuantity(1);
    setCurrentNotes('');
    setShowReasonModal(false);
  }

  function handleRemoveLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!selectedWarehouse || lines.length === 0) return;

    try {
      setSaving(true);

      const payload = {
        warehouseId: selectedWarehouse.WarehouseId,
        markdownDate: new Date().toISOString(),
        lines: lines.map(line => ({
          productId: line.productId,
          quantity: line.quantity,
          reason: line.reason,
          notes: line.notes,
          photoUrl: line.photoUrl,
        })),
        notes: `Démarque créée depuis mobile - ${lines.length} ligne(s)`,
      };

      const response = await fetch('/api/stock/markdowns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/stock/markdowns/${result.data.MarkdownId}`);
      } else {
        alert('Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-4 hover:opacity-80"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="w-7 h-7" />
            Nouvelle Démarque
          </h1>
          <p className="text-sm opacity-90 mt-1">Enregistrer pertes, casses, vols, etc.</p>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 3 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Étape 1: Sélection entrepôt */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4">1. Choisir l'entrepôt</h2>
            <div className="space-y-3">
              {warehouses.map((warehouse) => (
                <button
                  key={warehouse.WarehouseId}
                  onClick={() => handleWarehouseSelect(warehouse)}
                  className="w-full bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4 text-left hover:scale-105 active:scale-95 transition-transform"
                >
                  <p className="font-bold text-lg text-blue-900">{warehouse.Name}</p>
                  {warehouse.Location && (
                    <p className="text-sm text-blue-700 mt-1">{warehouse.Location}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Étape 2: Sélection produits */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Entrepôt sélectionné */}
            <div className="bg-white rounded-2xl shadow-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Entrepôt</p>
                  <p className="font-bold text-lg">{selectedWarehouse?.Name}</p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-blue-600 text-sm font-medium"
                >
                  Changer
                </button>
              </div>
            </div>

            {/* Lignes ajoutées */}
            {lines.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">
                    Produits démarqués ({lines.length})
                  </h2>
                  <Button
                    onClick={() => setStep(3)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Continuer
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, index) => {
                    const config = reasonConfig[line.reason];
                    const Icon = config.icon;

                    return (
                      <div
                        key={index}
                        className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4"
                      >
                        <div className="flex items-start gap-3">
                          {(line.product as any)?.ImageUrl && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-white flex-shrink-0">
                              <Image
                                src={(line.product as any).ImageUrl}
                                alt={line.product?.Name || ''}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{line.product?.Name}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Quantité: <span className="font-bold">{line.quantity}</span>
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Icon className="w-4 h-4 text-red-600" />
                              <span className="text-sm font-medium text-red-700">
                                {config.label}
                              </span>
                            </div>
                            {line.notes && (
                              <p className="text-xs text-gray-600 mt-2 italic">
                                {line.notes}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveLine(index)}
                            className="flex-shrink-0 p-2 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bouton ajouter produit */}
            <button
              onClick={() => setShowProductModal(true)}
              className="w-full bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-2xl p-6 shadow-xl hover:scale-105 active:scale-95 transition-transform"
            >
              <Package className="w-12 h-12 mx-auto mb-2" />
              <p className="font-bold text-lg">Ajouter un produit</p>
              <p className="text-sm opacity-90 mt-1">Enregistrer une démarque</p>
            </button>
          </div>
        )}

        {/* Étape 3: Confirmation */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4">3. Confirmer la démarque</h2>

            {/* Résumé */}
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Entrepôt</p>
                  <p className="font-bold">{selectedWarehouse?.Name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Produits</p>
                  <p className="font-bold">{lines.length} article(s)</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Quantité totale démarquée</p>
                <p className="text-3xl font-bold text-red-700">
                  {lines.reduce((sum, l) => sum + l.quantity, 0)} unités
                </p>
              </div>
            </div>

            {/* Détails lignes */}
            <div className="space-y-3 mb-6">
              {lines.map((line, index) => {
                const config = reasonConfig[line.reason];
                return (
                  <div key={index} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{line.product?.Name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {line.quantity} unités • {config.label}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1"
              >
                Retour
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Confirmer la démarque
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Sélection produit */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="font-bold text-xl">Choisir le produit</h2>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductVisualCard
                    key={product.ProductId}
                    product={product}
                    onClick={() => handleProductSelect(product)}
                    size="md"
                    showStock={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Raison et quantité */}
      {showReasonModal && currentProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="font-bold text-xl">Détails de la démarque</h2>
              <p className="text-gray-600 mt-1">{currentProduct.Name}</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Raison */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Raison de la démarque
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(reasonConfig) as MarkdownReason[]).map((reason) => {
                    const config = reasonConfig[reason];
                    const Icon = config.icon;

                    return (
                      <button
                        key={reason}
                        onClick={() => setCurrentReason(reason)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          currentReason === reason
                            ? 'border-red-600 bg-red-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mb-2 mx-auto ${config.color}`} />
                        <p className={`text-sm font-medium ${currentReason === reason ? 'text-red-900' : 'text-gray-700'}`}>
                          {config.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantité */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quantité
                </label>
                <div className="flex gap-2 mb-3">
                  {[1, 5, 10, 20].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => setCurrentQuantity(qty)}
                      className={`flex-1 h-12 rounded-xl font-bold transition-colors ${
                        currentQuantity === qty
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={currentQuantity}
                  onChange={(e) => setCurrentQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500"
                  min="1"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={currentNotes}
                  onChange={(e) => setCurrentNotes(e.target.value)}
                  placeholder="Détails supplémentaires..."
                  className="w-full h-24 p-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowReasonModal(false);
                    setCurrentProduct(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleAddLine}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
