'use client';

/**
 * Page - Créer un Mouvement de Stock
 * Module Stocks & Mouvements
 * Production → Entrepôt → Distribution
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '@/components/rbac/protected-page';
import { PERMISSIONS } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Product, Warehouse } from '@/types/modules';
import { ArrowDown, ArrowUp, ArrowLeftRight, Save } from 'lucide-react';

export default function NewStockMovementPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: 'entry' as 'entry' | 'exit' | 'transfer' | 'adjustment' | 'return',
    productId: '',
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    quantity: 0,
    unitCost: 0,
    reason: '',
    reference: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load products
      const productsRes = await fetch('/api/products?isActive=true');
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.data || []);
      }

      // Load warehouses
      const warehousesRes = await fetch('/api/stock/warehouses?isActive=true');
      if (warehousesRes.ok) {
        const warehousesData = await warehousesRes.json();
        setWarehouses(warehousesData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création');
      }

      const result = await response.json();
      alert(`✅ Mouvement ${result.data.MovementNumber} créé avec succès!`);
      router.push('/stock/movements');
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function getTypeIcon(type: string) {
    const icons = {
      entry: <ArrowDown className="h-5 w-5" />,
      exit: <ArrowUp className="h-5 w-5" />,
      transfer: <ArrowLeftRight className="h-5 w-5" />,
    };
    return icons[type as keyof typeof icons];
  }

  return (
    <ProtectedPage permission={PERMISSIONS.STOCK_CREATE}>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Nouveau Mouvement de Stock</h1>
          <p className="text-gray-600">Créer une entrée, sortie ou transfert de stock</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle>1. Type de Mouvement</CardTitle>
                <CardDescription>Sélectionnez le type d'opération</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'entry' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      formData.type === 'entry'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDown className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">Entrée</span>
                    </div>
                    <p className="text-sm text-gray-600">Production → Entrepôt</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'exit' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      formData.type === 'exit'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUp className="h-5 w-5 text-red-600" />
                      <span className="font-semibold">Sortie</span>
                    </div>
                    <p className="text-sm text-gray-600">Entrepôt → Distribution</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'transfer' })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      formData.type === 'transfer'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold">Transfert</span>
                    </div>
                    <p className="text-sm text-gray-600">Entrepôt → Entrepôt</p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Product & Warehouse */}
            <Card>
              <CardHeader>
                <CardTitle>2. Produit & Entrepôt(s)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Produit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">Sélectionner un produit</option>
                    {products.map((product) => (
                      <option key={product.ProductId} value={product.ProductId}>
                        {product.Name} ({product.Code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source Warehouse (for exit & transfer) */}
                {(formData.type === 'exit' || formData.type === 'transfer') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Entrepôt Source <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.sourceWarehouseId}
                      onChange={(e) => setFormData({ ...formData, sourceWarehouseId: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner l'entrepôt source</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.WarehouseId} value={warehouse.WarehouseId}>
                          {warehouse.Name} ({warehouse.Code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Destination Warehouse (for entry & transfer) */}
                {(formData.type === 'entry' || formData.type === 'transfer') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Entrepôt Destination <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.destinationWarehouseId}
                      onChange={(e) => setFormData({ ...formData, destinationWarehouseId: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Sélectionner l'entrepôt destination</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.WarehouseId} value={warehouse.WarehouseId}>
                          {warehouse.Name} ({warehouse.Code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quantity & Cost */}
            <Card>
              <CardHeader>
                <CardTitle>3. Quantité & Valorisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Quantité <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ex: 100"
                      required
                    />
                  </div>

                  {formData.type === 'entry' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Coût Unitaire (XOF) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.unitCost}
                        onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })}
                        className="w-full border rounded px-3 py-2"
                        placeholder="Ex: 5000"
                        required
                      />
                    </div>
                  )}
                </div>

                {formData.type === 'entry' && formData.quantity > 0 && formData.unitCost > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Valeur totale</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF',
                        minimumFractionDigits: 0,
                      }).format(formData.quantity * formData.unitCost)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Info */}
            <Card>
              <CardHeader>
                <CardTitle>4. Informations Complémentaires</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Raison / Motif</label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ex: Production journalière, Commande client..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Référence</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Ex: PROD-2025-001, BL-12345..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {loading ? 'Enregistrement...' : 'Créer le Mouvement'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/stock/movements')}>
                Annuler
              </Button>
            </div>
          </div>
        </form>
      </div>
    </ProtectedPage>
  );
}
