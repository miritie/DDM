'use client';

/**
 * Page - Mouvement Stock Rapide (Mobile-First)
 * Interface visuelle simplifiée pour mouvements terrain ultra-rapides
 * Usage: Stands, livraisons, transferts, ajustements
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Plus,
  Minus,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Repeat,
} from 'lucide-react';
import { Product, Warehouse } from '@/types/modules';
import { ProductVisualCard } from '@/components/stock/product-visual-card';
import { Button } from '@/components/ui/button';

type MovementType = 'entry' | 'exit' | 'transfer' | 'adjustment';

interface MovementLine {
  productId: string;
  productName: string;
  quantity: number;
  productImage?: string;
}

export default function QuickMovementPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [sourceWarehouse, setSourceWarehouse] = useState<Warehouse | null>(
    null
  );
  const [destinationWarehouse, setDestinationWarehouse] =
    useState<Warehouse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movementLines, setMovementLines] = useState<Map<string, MovementLine>>(
    new Map()
  );
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [productsRes, warehousesRes] = await Promise.all([
        fetch('/api/products?isActive=true'),
        fetch('/api/stock/warehouses?isActive=true'),
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.data || []);
      }

      if (warehousesRes.ok) {
        const warehousesData = await warehousesRes.json();
        setWarehouses(warehousesData.data || []);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }

  const movementTypes = [
    {
      id: 'entry' as MovementType,
      label: 'Entrée',
      icon: Plus,
      gradient: 'from-green-500 to-emerald-600',
      description: 'Réception marchandise',
    },
    {
      id: 'exit' as MovementType,
      label: 'Sortie',
      icon: Minus,
      gradient: 'from-red-500 to-pink-600',
      description: 'Vente, livraison',
    },
    {
      id: 'transfer' as MovementType,
      label: 'Transfert',
      icon: Repeat,
      gradient: 'from-blue-500 to-cyan-600',
      description: 'Entre entrepôts',
    },
    {
      id: 'adjustment' as MovementType,
      label: 'Ajustement',
      icon: RefreshCw,
      gradient: 'from-orange-500 to-amber-600',
      description: 'Correction, perte',
    },
  ];

  const handleAddProduct = () => {
    if (!selectedProduct || !quantityInput) return;

    const quantity = parseInt(quantityInput);
    if (quantity <= 0) return;

    const line: MovementLine = {
      productId: selectedProduct.ProductId,
      productName: selectedProduct.Name,
      quantity,
      productImage: (selectedProduct as any).ImageUrl,
    };

    const newLines = new Map(movementLines);
    newLines.set(selectedProduct.ProductId, line);
    setMovementLines(newLines);

    setSelectedProduct(null);
    setQuantityInput('');
  };

  const handleRemoveLine = (productId: string) => {
    const newLines = new Map(movementLines);
    newLines.delete(productId);
    setMovementLines(newLines);
  };

  const handleSaveMovement = async () => {
    if (movementLines.size === 0) return;

    setSaving(true);
    try {
      const lines = Array.from(movementLines.values()).map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      }));

      const response = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: movementType,
          sourceWarehouseId: sourceWarehouse?.WarehouseId,
          destinationWarehouseId: destinationWarehouse?.WarehouseId,
          lines,
          notes: `Mouvement rapide mobile ${new Date().toLocaleDateString(
            'fr-FR'
          )}`,
        }),
      });

      if (response.ok) {
        alert('Mouvement enregistré avec succès!');
        router.push('/stock/movements');
      } else {
        alert("Erreur lors de l'enregistrement");
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const canProceedToStep2 = movementType !== null;
  const canProceedToStep3 =
    (movementType === 'transfer' &&
      sourceWarehouse &&
      destinationWarehouse) ||
    (movementType !== 'transfer' && sourceWarehouse);
  const canSave = movementLines.size > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 sticky top-0 z-10 shadow-lg">
        <button
          onClick={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as any))}
          className="flex items-center gap-2 mb-3 hover:opacity-80"
        >
          <ArrowLeft className="w-5 h-5" />
          {step === 1 ? 'Retour' : 'Étape précédente'}
        </button>

        <h1 className="text-2xl font-bold">Mouvement Rapide</h1>
        <div className="flex items-center gap-2 mt-3">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Étape 1: Type de mouvement */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Type de mouvement</h2>
            <div className="grid grid-cols-2 gap-4">
              {movementTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      setMovementType(type.id);
                      setStep(2);
                    }}
                    className={`p-6 rounded-2xl bg-gradient-to-br ${type.gradient} text-white hover:scale-105 active:scale-95 transition-transform shadow-lg`}
                  >
                    <Icon className="w-12 h-12 mb-3" />
                    <p className="text-xl font-bold mb-1">{type.label}</p>
                    <p className="text-sm opacity-90">{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape 2: Sélection entrepôt(s) */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">
              {movementType === 'transfer'
                ? 'Entrepôts source et destination'
                : 'Sélection entrepôt'}
            </h2>

            {movementType === 'transfer' ? (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Source (Départ)
                  </p>
                  <div className="space-y-2">
                    {warehouses.map((w) => (
                      <button
                        key={w.WarehouseId}
                        onClick={() => setSourceWarehouse(w)}
                        className={`w-full p-4 rounded-xl text-left transition-all ${
                          sourceWarehouse?.WarehouseId === w.WarehouseId
                            ? 'bg-blue-600 text-white ring-4 ring-blue-300'
                            : 'bg-white hover:bg-blue-50'
                        }`}
                      >
                        <p className="font-bold">{w.Name}</p>
                        <p className="text-sm opacity-80">{w.Location}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Destination (Arrivée)
                  </p>
                  <div className="space-y-2">
                    {warehouses
                      .filter(
                        (w) => w.WarehouseId !== sourceWarehouse?.WarehouseId
                      )
                      .map((w) => (
                        <button
                          key={w.WarehouseId}
                          onClick={() => setDestinationWarehouse(w)}
                          className={`w-full p-4 rounded-xl text-left transition-all ${
                            destinationWarehouse?.WarehouseId ===
                            w.WarehouseId
                              ? 'bg-green-600 text-white ring-4 ring-green-300'
                              : 'bg-white hover:bg-green-50'
                          }`}
                        >
                          <p className="font-bold">{w.Name}</p>
                          <p className="text-sm opacity-80">{w.Location}</p>
                        </button>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {warehouses.map((w) => (
                  <button
                    key={w.WarehouseId}
                    onClick={() => setSourceWarehouse(w)}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      sourceWarehouse?.WarehouseId === w.WarehouseId
                        ? 'bg-blue-600 text-white ring-4 ring-blue-300'
                        : 'bg-white hover:bg-blue-50'
                    }`}
                  >
                    <p className="font-bold">{w.Name}</p>
                    <p className="text-sm opacity-80">{w.Location}</p>
                  </button>
                ))}
              </div>
            )}

            <Button
              onClick={() => setStep(3)}
              disabled={!canProceedToStep3}
              className="w-full h-14 text-lg bg-blue-600"
            >
              Continuer
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Étape 3: Sélection produits */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                Produits ({movementLines.size})
              </h2>
              {movementLines.size > 0 && (
                <Button
                  onClick={() => setStep(4)}
                  className="bg-green-600 h-10"
                >
                  Valider ({movementLines.size})
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>

            {/* Lignes ajoutées */}
            {movementLines.size > 0 && (
              <div className="bg-white rounded-2xl p-4 space-y-2">
                {Array.from(movementLines.values()).map((line) => (
                  <div
                    key={line.productId}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-xl"
                  >
                    <div>
                      <p className="font-bold">{line.productName}</p>
                      <p className="text-sm text-gray-600">
                        Quantité: {line.quantity}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveLine(line.productId)}
                      className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Liste produits */}
            <div className="space-y-3">
              {products.map((product) => (
                <ProductVisualCard
                  key={product.ProductId}
                  product={product}
                  onClick={() => setSelectedProduct(product)}
                  size="lg"
                  showStock={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Étape 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Confirmation</h2>

            <div className="bg-white rounded-2xl p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="text-xl font-bold capitalize">
                  {movementTypes.find((t) => t.id === movementType)?.label}
                </p>
              </div>

              {sourceWarehouse && (
                <div>
                  <p className="text-sm text-gray-600">
                    {movementType === 'transfer' ? 'Source' : 'Entrepôt'}
                  </p>
                  <p className="text-lg font-bold">{sourceWarehouse.Name}</p>
                </div>
              )}

              {destinationWarehouse && (
                <div>
                  <p className="text-sm text-gray-600">Destination</p>
                  <p className="text-lg font-bold">
                    {destinationWarehouse.Name}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 mb-2">Produits</p>
                {Array.from(movementLines.values()).map((line) => (
                  <div
                    key={line.productId}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span>{line.productName}</span>
                    <span className="font-bold">{line.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSaveMovement}
              disabled={saving || !canSave}
              className="w-full h-16 text-xl bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6 mr-2" />
                  Valider le mouvement
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Modal saisie quantité */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-2xl p-6 animate-slide-up">
            <h2 className="text-xl font-bold mb-4">
              {selectedProduct.Name}
            </h2>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[1, 5, 10, 20].map((val) => (
                <button
                  key={val}
                  onClick={() => setQuantityInput(String(val))}
                  className="h-14 bg-gray-100 hover:bg-blue-100 rounded-xl font-bold text-lg"
                >
                  {val}
                </button>
              ))}
            </div>

            <input
              type="number"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              placeholder="Quantité"
              autoFocus
              className="w-full h-14 text-2xl text-center font-bold border-2 rounded-xl mb-4"
            />

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setSelectedProduct(null);
                  setQuantityInput('');
                }}
                className="flex-1 h-12 bg-gray-200 text-gray-800"
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddProduct}
                disabled={!quantityInput}
                className="flex-[2] h-12 bg-blue-600"
              >
                <Plus className="w-5 h-5 mr-2" />
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
