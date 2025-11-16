'use client';

/**
 * Page - Nouvel Ordre de Production (Mobile-First Wizard)
 * Interface simplifiée pour lancer rapidement une production
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Factory,
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar,
  Package,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  User,
} from 'lucide-react';
import { Recipe, Warehouse, Product } from '@/types/modules';
import { RecipeCard } from '@/components/production/recipe-card';
import { Button } from '@/components/ui/button';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

const priorityConfig: Record<Priority, { label: string; color: string; gradient: string }> = {
  low: {
    label: 'Basse',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    gradient: 'from-gray-400 to-gray-600',
  },
  normal: {
    label: 'Normale',
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    gradient: 'from-blue-500 to-cyan-600',
  },
  high: {
    label: 'Haute',
    color: 'bg-orange-100 text-orange-700 border-orange-300',
    gradient: 'from-orange-500 to-amber-600',
  },
  urgent: {
    label: 'Urgente',
    color: 'bg-red-100 text-red-700 border-red-300',
    gradient: 'from-red-500 to-pink-600',
  },
};

export default function NewProductionOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Recette, 2: Quantité + Dates, 3: Entrepôts + Priorité, 4: Confirmation
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form data
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [plannedQuantity, setPlannedQuantity] = useState(1);
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [sourceWarehouse, setSourceWarehouse] = useState<Warehouse | null>(null);
  const [destinationWarehouse, setDestinationWarehouse] = useState<Warehouse | null>(null);
  const [priority, setPriority] = useState<Priority>('normal');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    // Set default dates (start: today, end: today + 7 days)
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    setPlannedStartDate(today.toISOString().split('T')[0]);
    setPlannedEndDate(nextWeek.toISOString().split('T')[0]);
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [recipesRes, warehousesRes, productsRes] = await Promise.all([
        fetch('/api/production/recipes?isActive=true'),
        fetch('/api/stock/warehouses?isActive=true'),
        fetch('/api/products?isActive=true'),
      ]);

      if (recipesRes.ok) {
        const data = await recipesRes.json();
        setRecipes(data.data || []);
      }

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

  function getProductImage(productId: string): string | undefined {
    return (products.find((p) => p.ProductId === productId) as any)?.ImageUrl;
  }

  async function handleSave() {
    if (!selectedRecipe) return;

    try {
      setSaving(true);

      const payload = {
        recipeId: selectedRecipe.RecipeId,
        plannedQuantity,
        plannedStartDate: new Date(plannedStartDate).toISOString(),
        plannedEndDate: new Date(plannedEndDate).toISOString(),
        priority,
        sourceWarehouseId: sourceWarehouse?.WarehouseId,
        destinationWarehouseId: destinationWarehouse?.WarehouseId,
        notes: notes || undefined,
      };

      const response = await fetch('/api/production/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/production/orders/${result.data.ProductionOrderId}`);
      } else {
        alert('Erreur lors de la création');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

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
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-4 hover:opacity-80"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Retour</span>
          </button>

          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="w-7 h-7" />
            Nouvel Ordre de Production
          </h1>
          <p className="text-sm opacity-90 mt-1">Lancer une nouvelle production</p>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 3 ? 'bg-white' : 'bg-white/30'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 4 ? 'bg-white' : 'bg-white/30'}`} />
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 -mt-4">
        {/* Étape 1: Sélection recette */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4">1. Choisir la recette</h2>

            {selectedRecipe && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-900">{selectedRecipe.Name}</p>
                    <p className="text-sm text-green-700 mt-1">
                      Produit {selectedRecipe.OutputQuantity} {selectedRecipe.OutputUnit}
                    </p>
                  </div>
                  <Button onClick={() => setStep(2)} className="bg-green-600 hover:bg-green-700">
                    Continuer
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.RecipeId}
                  recipe={recipe}
                  onClick={() => setSelectedRecipe(recipe)}
                  showDetails={false}
                  productImage={getProductImage(recipe.ProductId)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Étape 2: Quantité et Dates */}
        {step === 2 && selectedRecipe && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4">2. Quantité et Planning</h2>

            {/* Recette sélectionnée */}
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-600">Recette sélectionnée</p>
              <p className="font-bold text-lg text-purple-900">{selectedRecipe.Name}</p>
              <p className="text-sm text-purple-700 mt-1">
                {selectedRecipe.OutputQuantity} {selectedRecipe.OutputUnit} par batch
              </p>
            </div>

            <div className="space-y-6">
              {/* Quantité */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quantité à produire
                </label>
                <div className="flex gap-2 mb-3">
                  {[1, 5, 10, 20, 50, 100].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => setPlannedQuantity(qty)}
                      className={`flex-1 h-12 rounded-xl font-bold transition-colors ${
                        plannedQuantity === qty
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={plannedQuantity}
                  onChange={(e) => setPlannedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-orange-500"
                  min="1"
                />
                <p className="text-sm text-gray-600 mt-2 text-center">
                  = {plannedQuantity * selectedRecipe.OutputQuantity} {selectedRecipe.OutputUnit} au total
                </p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de début
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="date"
                      value={plannedStartDate}
                      onChange={(e) => setPlannedStartDate(e.target.value)}
                      className="w-full pl-10 pr-4 h-12 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="date"
                      value={plannedEndDate}
                      onChange={(e) => setPlannedEndDate(e.target.value)}
                      min={plannedStartDate}
                      className="w-full pl-10 pr-4 h-12 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                  Retour
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  Continuer
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Étape 3: Entrepôts et Priorité */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4">3. Configuration</h2>

            <div className="space-y-6">
              {/* Entrepôts */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Entrepôt source (matières premières)
                </label>
                <div className="space-y-2">
                  {warehouses.map((warehouse) => (
                    <button
                      key={warehouse.WarehouseId}
                      onClick={() => setSourceWarehouse(warehouse)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                        sourceWarehouse?.WarehouseId === warehouse.WarehouseId
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold">{warehouse.Name}</p>
                      {warehouse.Location && (
                        <p className="text-sm text-gray-600 mt-1">{warehouse.Location}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Entrepôt destination (produits finis)
                </label>
                <div className="space-y-2">
                  {warehouses.map((warehouse) => (
                    <button
                      key={warehouse.WarehouseId}
                      onClick={() => setDestinationWarehouse(warehouse)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-colors ${
                        destinationWarehouse?.WarehouseId === warehouse.WarehouseId
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold">{warehouse.Name}</p>
                      {warehouse.Location && (
                        <p className="text-sm text-gray-600 mt-1">{warehouse.Location}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priorité */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Priorité
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(priorityConfig) as Priority[]).map((pri) => {
                    const config = priorityConfig[pri];
                    return (
                      <button
                        key={pri}
                        onClick={() => setPriority(pri)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          priority === pri
                            ? config.color.replace('bg-', 'border-')
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <p className={`font-semibold ${priority === pri ? config.color.split(' ')[1] : 'text-gray-700'}`}>
                          {config.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instructions spéciales, remarques..."
                  className="w-full h-24 p-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                  Retour
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  Continuer
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Étape 4: Confirmation */}
        {step === 4 && selectedRecipe && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="font-bold text-lg mb-4">4. Confirmer l'ordre</h2>

            {/* Résumé */}
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Recette</p>
                  <p className="font-bold">{selectedRecipe.Name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Produit</p>
                  <p className="font-bold">{selectedRecipe.ProductName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Quantité</p>
                  <p className="font-bold">{plannedQuantity} batch(s)</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Production totale</p>
                  <p className="font-bold">
                    {plannedQuantity * selectedRecipe.OutputQuantity} {selectedRecipe.OutputUnit}
                  </p>
                </div>
              </div>

              <div className="border-t border-orange-200 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Début</p>
                  <p className="font-bold">
                    {new Date(plannedStartDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fin prévue</p>
                  <p className="font-bold">
                    {new Date(plannedEndDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-3 mb-6">
              {sourceWarehouse && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Entrepôt source</p>
                  <p className="font-semibold">{sourceWarehouse.Name}</p>
                </div>
              )}

              {destinationWarehouse && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Entrepôt destination</p>
                  <p className="font-semibold">{destinationWarehouse.Name}</p>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">Priorité</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${priorityConfig[priority].color}`}>
                  {priorityConfig[priority].label}
                </span>
              </div>

              {notes && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Notes</p>
                  <p className="text-sm">{notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={() => setStep(3)} variant="outline" className="flex-1">
                Retour
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Création...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Créer l'ordre
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
